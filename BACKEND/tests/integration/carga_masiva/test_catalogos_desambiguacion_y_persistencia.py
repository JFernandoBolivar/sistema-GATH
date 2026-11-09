"""Pruebas de desambiguación de catálogos y persistencia completa en BD (FIX-O47).

Verifica:
1. Ninguna lista desplegable en ninguna plantilla contiene etiquetas duplicadas.
2. Desambiguación de municipios y parroquias repetidos ('MIRANDA (FALCÓN)').
3. Validación jerárquica estado -> municipio -> parroquia en análisis.
4. Tipo 'antecedentes_laborales':
   - 'Cargo' eliminado de plantilla, clave y análisis.
   - 'Organismo' como catálogo desde OrganismoAdscritoModel.
   - Clave única (cédula, organismo, fecha_ingreso) no duplica en BD.
   - Persistencia real de organismo en AntecedenteServicioModel.
   - Validación fecha_egreso >= fecha_ingreso.
5. Persistencia completa de vivienda (parroquia y condición guardadas).
6. Persistencia de formación académica y formación complementaria.
"""
import datetime
import io
import pytest
from openpyxl import load_workbook

from apps.carga_masiva.domain.registro_campos import (
    POBLACION_ACTIVOS,
    POBLACION_PASIVOS,
    TIPOS_CARGA,
    TIPOS_POR_CLAVE,
)
from apps.carga_masiva.infrastructure.analisis import _analizar_fila, analizar_archivo
from apps.carga_masiva.infrastructure.aplicacion import aplicar_carga
from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel, CargaMasivaModel
from apps.carga_masiva.infrastructure.plantilla_excel import generar_plantilla
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    EstatusModel,
    NacionalidadModel,
    PaisModel,
    ParentescoModel,
    SexoModel,
    TipoNominaModel,
    TipoProcedenciaModel,
)
from apps.catalogos.infrastructure.models.geografia_models import (
    EstadoModel,
    MunicipioModel,
    ParroquiaModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CapacitacionModel,
    CarreraModel,
    CodigoPostalModel,
    CondicionViviendaModel,
    DiscapacidadModel,
    InstitucionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
    RegionTallaModel,
    TallaModel,
    TipoPrendaModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    DatosViviendaModel,
    FormacionAcademicaModel,
    FormacionComplementariaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db


@pytest.fixture
def datos_base():
    # Geografia
    edo_fal, _ = EstadoModel.objects.get_or_create(estado='FALCÓN')
    edo_zul, _ = EstadoModel.objects.get_or_create(estado='ZULIA')
    edo_car, _ = EstadoModel.objects.get_or_create(estado='CARABOBO')

    mun_mir_fal, _ = MunicipioModel.objects.get_or_create(municipio='MIRANDA', estadoid=edo_fal)
    mun_mir_car, _ = MunicipioModel.objects.get_or_create(municipio='MIRANDA', estadoid=edo_car)
    mun_mar_zul, _ = MunicipioModel.objects.get_or_create(municipio='MARACAIBO', estadoid=edo_zul)

    par_cat_fal, _ = ParroquiaModel.objects.get_or_create(parroquia='SAN ANTONIO', municipioid=mun_mir_fal)
    par_cat_car, _ = ParroquiaModel.objects.get_or_create(parroquia='SAN ANTONIO', municipioid=mun_mir_car)

    cond_viv, _ = CondicionViviendaModel.objects.get_or_create(condicion='PROPIA')
    cp_fal, _ = CodigoPostalModel.objects.get_or_create(codigo='4101', estado_id=edo_fal)

    # Organismos
    org_conatel, _ = OrganismoAdscritoModel.objects.get_or_create(Organismoadscrito='CONATEL')
    org_cantv, _ = OrganismoAdscritoModel.objects.get_or_create(Organismoadscrito='CANTV')

    # Formación
    nivel_univ, _ = NivelAcademicoModel.objects.get_or_create(nivelacademico='UNIVERSITARIO')
    carrera_ing, _ = CarreraModel.objects.get_or_create(nombre_carrera='INGENIERÍA TELECOMUNICACIONES', defaults={'nivel_academico_id': nivel_univ})
    inst_ucv, _ = InstitucionModel.objects.get_or_create(nombre_institucion='UNIVERSIDAD CENTRAL DE VENEZUELA')
    proc, _ = TipoProcedenciaModel.objects.get_or_create(tipo_procedencia='INTERNA')

    # Paises
    pais_ve, _ = PaisModel.objects.get_or_create(codigo='VE', defaults={'nombre': 'VENEZUELA', 'es_venezuela': True})
    pais_es, _ = PaisModel.objects.get_or_create(codigo='ES', defaults={'nombre': 'ESPAÑA', 'es_venezuela': False})

    # Persona y tallas
    nac, _ = NacionalidadModel.objects.get_or_create(codigo='V', defaults={'nombre': 'VENEZOLANA'})
    sex, _ = SexoModel.objects.get_or_create(sexo='MASCULINO')
    reg, _ = RegionTallaModel.objects.get_or_create(codigo='REG1', defaults={'descripcion': 'NAC'})
    prend_cam, _ = TipoPrendaModel.objects.get_or_create(categoria='CAMISA')
    talla_m, _ = TallaModel.objects.get_or_create(valor='M', region=reg, tipo_prenda=prend_cam)

    emp, _ = EmployeeModel.objects.get_or_create(
        cedulaidentidad='88770001',
        defaults={
            'nombres': 'PEDRO',
            'apellidos': 'PEREZ',
            'fecha_nacimiento': datetime.date(1985, 3, 10),
            'sexoid': sex,
            'nacionalidad': nac,
            'total_anos_apn': 0,
        },
    )

    return {
        'empleado': emp,
        'organismo': org_conatel,
        'organismo_cantv': org_cantv,
        'estado_falcon': edo_fal,
        'estado_zulia': edo_zul,
        'municipio_miranda_falcon': mun_mir_fal,
        'municipio_miranda_carabobo': mun_mir_car,
        'municipio_maracaibo': mun_mar_zul,
        'parroquia_san_antonio_falcon': par_cat_fal,
        'parroquia_san_antonio_carabobo': par_cat_car,
        'condicion_vivienda': cond_viv,
        'codigo_postal_falcon': cp_fal,
        'carrera': carrera_ing,
        'institucion': inst_ucv,
        'nivel_academico': nivel_univ,
        'procedencia': proc,
        'pais_venezuela': pais_ve,
        'pais_espana': pais_es,
    }


def test_todas_las_listas_de_todas_las_plantillas_sin_etiquetas_duplicadas(datos_base):
    """Recorre todas las plantillas generadas y falla si alguna lista contiene etiquetas repetidas."""
    combinaciones = [
        (POBLACION_ACTIVOS, 'obligatorios'),
        (POBLACION_ACTIVOS, 'completo'),
        (POBLACION_PASIVOS, 'obligatorios'),
        (POBLACION_PASIVOS, 'completo'),
    ]

    for poblacion, modo in combinaciones:
        contenido = generar_plantilla(None, modo=modo, poblacion=poblacion)
        wb = load_workbook(io.BytesIO(contenido))
        assert 'Catalogos' in wb.sheetnames, f"La plantilla {poblacion}-{modo} debe incluir la hoja Catalogos."
        hoja_cat = wb['Catalogos']

        # Verificar cada columna del catálogo
        for col_idx in range(1, hoja_cat.max_column + 1):
            nombre_cat = hoja_cat.cell(row=1, column=col_idx).value
            if not nombre_cat:
                continue

            valores: list[str] = []
            for row_idx in range(2, hoja_cat.max_row + 1):
                val = hoja_cat.cell(row=row_idx, column=col_idx).value
                if val is not None and str(val).strip():
                    valores.append(str(val).strip())

            unicos = set(valores)
            duplicados = [v for v in unicos if valores.count(v) > 1]
            assert len(valores) == len(unicos), (
                f"Plantilla {poblacion} ({modo}), catálogo '{nombre_cat}': "
                f"tiene etiquetas duplicadas: {duplicados}"
            )


def test_antecedentes_laborales_quitar_cargo_catalogo_organismo_persistencia(datos_base):
    """Verifica (1) sin cargo, (2) organismo como FK catálogo, (3) guarda en BD y no duplica."""
    emp = datos_base['empleado']
    org = datos_base['organismo']

    # 1. Verificar definición de campos
    tipo_ant = TIPOS_POR_CLAVE['antecedentes_laborales']
    assert tipo_ant.campo('cargo') is None, "El campo 'cargo' debe estar eliminado de antecedentes_laborales."
    assert tipo_ant.campo('organismo').tipo == 'catalogo', "'organismo' debe ser de tipo catálogo."
    assert tipo_ant.campo('organismo').catalogo == 'organismo'
    assert 'cargo' not in tipo_ant.clave_negocio
    assert tipo_ant.clave_negocio == ('cedula', 'organismo', 'fecha_ingreso')

    # 2. Aplicar carga masiva
    carga = CargaMasivaModel.objects.create(
        archivo_nombre='antecedentes.xlsx',
        poblacion=POBLACION_ACTIVOS,
        tipos=['antecedentes_laborales'],
        solicitada_por_cedula='1',
        estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    CargaMasivaFilaModel.objects.create(
        carga=carga,
        hoja='Antecedentes laborales',
        tipo='antecedentes_laborales',
        numero_fila=5,
        estado=CargaMasivaFilaModel.Estado.NUEVO,
        datos={
            'cedula': emp.cedulaidentidad,
            'organismo': org.Organismoadscrito,
            'fecha_ingreso': '2019-02-01',
            'fecha_egreso': '2023-01-31',
        },
        anteriores={},
    )

    res = aplicar_carga(carga, '1')
    assert res.estado == CargaMasivaModel.Estado.APLICADA
    fila = carga.filas.first()
    assert fila.aplicada is True
    assert fila.error_aplicacion == ''

    # 3. Verificar persistencia real en BD
    ant = AntecedenteServicioModel.objects.get(empleado_id=emp.pk, fecha_ingreso=datetime.date(2019, 2, 1))
    assert ant.organismo_id == org.pk, "El organismo debe quedar guardado en AntecedenteServicioModel."
    assert ant.fecha_egreso == datetime.date(2023, 1, 31)

    # 4. Actualización con la misma clave de negocio no duplica
    carga2 = CargaMasivaModel.objects.create(
        archivo_nombre='antecedentes_act.xlsx',
        poblacion=POBLACION_ACTIVOS,
        tipos=['antecedentes_laborales'],
        solicitada_por_cedula='1',
        estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    CargaMasivaFilaModel.objects.create(
        carga=carga2,
        hoja='Antecedentes laborales',
        tipo='antecedentes_laborales',
        numero_fila=6,
        estado=CargaMasivaFilaModel.Estado.ACTUALIZAR,
        datos={
            'cedula': emp.cedulaidentidad,
            'organismo': org.Organismoadscrito,
            'fecha_ingreso': '2019-02-01',
            'fecha_egreso': '2024-06-30',
        },
        anteriores={},
    )
    aplicar_carga(carga2, '1')
    assert AntecedenteServicioModel.objects.filter(empleado_id=emp.pk).count() == 1
    ant.refresh_from_db()
    assert ant.fecha_egreso == datetime.date(2024, 6, 30)


def test_antecedentes_laborales_valida_fechas_egreso_menor_ingreso(datos_base):
    """Fecha de egreso < fecha de ingreso debe ser rechazada en análisis y en aplicación."""
    emp = datos_base['empleado']
    org = datos_base['organismo']

    # 1. Validación en análisis
    tipo_ant = TIPOS_POR_CLAVE['antecedentes_laborales']
    estado, detalle, _ = _analizar_fila(
        tipo_ant,
        {
            'cedula': emp.cedulaidentidad,
            'organismo': org.Organismoadscrito,
            'fecha_ingreso': '2023-01-01',
            'fecha_egreso': '2020-01-01',
        },
        5,
        POBLACION_ACTIVOS,
    )
    assert estado == CargaMasivaFilaModel.Estado.ERROR
    assert 'mayor o igual' in detalle.lower()

    # 2. Validación en aplicación (savepoint por fila registra error y no aplica)
    carga = CargaMasivaModel.objects.create(
        archivo_nombre='ant_err.xlsx',
        poblacion=POBLACION_ACTIVOS,
        tipos=['antecedentes_laborales'],
        solicitada_por_cedula='1',
        estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    fila = CargaMasivaFilaModel.objects.create(
        carga=carga,
        hoja='Antecedentes laborales',
        tipo='antecedentes_laborales',
        numero_fila=5,
        estado=CargaMasivaFilaModel.Estado.NUEVO,
        datos={
            'cedula': emp.cedulaidentidad,
            'organismo': org.Organismoadscrito,
            'fecha_ingreso': '2023-01-01',
            'fecha_egreso': '2020-01-01',  # Inválido: menor a ingreso
        },
        anteriores={},
    )

    aplicar_carga(carga, '1')
    fila.refresh_from_db()
    assert fila.aplicada is False
    assert 'fecha de egreso' in fila.error_aplicacion.lower()


def test_vivienda_persistencia_completa_parroquia_y_condicion(datos_base):
    """Verifica que vivienda guarda correctamente parroquia y condición de vivienda."""
    emp = datos_base['empleado']
    edo = datos_base['estado_falcon']
    mun = datos_base['municipio_miranda_falcon']
    par = datos_base['parroquia_san_antonio_falcon']
    cond = datos_base['condicion_vivienda']
    cp = datos_base['codigo_postal_falcon']

    carga = CargaMasivaModel.objects.create(
        archivo_nombre='viv.xlsx',
        poblacion=POBLACION_ACTIVOS,
        tipos=['vivienda'],
        solicitada_por_cedula='1',
        estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    CargaMasivaFilaModel.objects.create(
        carga=carga,
        hoja='Vivienda',
        tipo='vivienda',
        numero_fila=5,
        estado=CargaMasivaFilaModel.Estado.NUEVO,
        datos={
            'cedula': emp.cedulaidentidad,
            'estado_id': edo.estado,
            'municipio_id': f"{mun.municipio} ({edo.estado})",
            'parroquia_id': f"{par.parroquia} ({mun.municipio} - {edo.estado})",
            'codigo_postal': cp.codigo,
            'direccion_exacta': 'CALLE UNION CASA 12',
            'condicion_vivienda_id': cond.condicion,
        },
        anteriores={},
    )
    aplicar_carga(carga, '1')
    f_res = carga.filas.first()
    assert f_res.aplicada is True, f"Error al aplicar vivienda: {f_res.error_aplicacion}"
    viv = DatosViviendaModel.objects.get(empleado_id=emp.pk)
    assert viv.estado_id == edo.pk
    assert viv.municipio_id == mun.pk
    assert viv.parroquia_id == par.pk, "La parroquia debe ser guardada en DatosViviendaModel."
    assert viv.codigo_postal_id == cp.pk, "El código postal debe ser guardado."
    assert viv.condicion_vivienda_id == cond.pk, "La condición de vivienda debe ser guardada."
    assert viv.direccion_exacta == 'CALLE UNION CASA 12'


def test_formacion_academica_y_complementaria_persistencia(datos_base):
    """Verifica la persistencia de carrera, institución y nivel en formación académica y complementaria."""
    emp = datos_base['empleado']
    carrera = datos_base['carrera']
    inst = datos_base['institucion']
    nivel = datos_base['nivel_academico']

    carga = CargaMasivaModel.objects.create(
        archivo_nombre='form.xlsx',
        poblacion=POBLACION_ACTIVOS,
        tipos=['formacion_academica', 'formacion_complementaria'],
        solicitada_por_cedula='1',
        estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    CargaMasivaFilaModel.objects.create(
        carga=carga,
        hoja='Formación académica',
        tipo='formacion_academica',
        numero_fila=5,
        estado=CargaMasivaFilaModel.Estado.NUEVO,
        datos={
            'cedula': emp.cedulaidentidad,
            'titulo': carrera.nombre_carrera,
            'institucion': inst.nombre_institucion,
            'nivel_academico_id': nivel.nivelacademico,
        },
        anteriores={},
    )
    CargaMasivaFilaModel.objects.create(
        carga=carga,
        hoja='Formación complementaria',
        tipo='formacion_complementaria',
        numero_fila=5,
        estado=CargaMasivaFilaModel.Estado.NUEVO,
        datos={
            'cedula': emp.cedulaidentidad,
            'curso': 'REDES FIBRA OPTICA',
            'institucion': inst.nombre_institucion,
            'fecha_inicio': '2024-01-10',
            'fecha_fin': '2024-02-10',
            'horas': 40,
        },
        anteriores={},
    )

    aplicar_carga(carga, '1')

    # Académica
    fa = FormacionAcademicaModel.objects.get(empleado_id=emp.pk)
    assert fa.carrera_id == carrera.pk
    assert fa.institucion_id == inst.pk
    assert fa.nivel_academico_id == nivel.pk

    # Complementaria
    fc = FormacionComplementariaModel.objects.get(empleado_id=emp.pk)
    assert fc.capacitacion.nombre_capacitacion == 'REDES FIBRA OPTICA'
    assert fc.institucion_id == inst.pk
    assert fc.procedencia is not None
    assert fc.horas_completadas == '40'


def test_vivienda_reglas_ubicacion_activos_venezuela(datos_base):
    """En población ACTIVOS: estado, municipio, parroquia, dirección y condición son obligatorios."""
    emp = datos_base['empleado']
    edo = datos_base['estado_falcon']
    mun = datos_base['municipio_miranda_falcon']
    par = datos_base['parroquia_san_antonio_falcon']
    cond = datos_base['condicion_vivienda']
    cp = datos_base['codigo_postal_falcon']
    tipo_viv = TIPOS_POR_CLAVE['vivienda']

    # Falla sin estado
    st, det, _ = _analizar_fila(
        tipo_viv,
        {'cedula': emp.cedulaidentidad, 'direccion_exacta': 'CALLE 1 CASA 2', 'condicion_vivienda_id': cond.condicion},
        5,
        POBLACION_ACTIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'estado' in det.lower()

    # Falla sin municipio
    st, det, _ = _analizar_fila(
        tipo_viv,
        {
            'cedula': emp.cedulaidentidad,
            'estado_id': edo.estado,
            'direccion_exacta': 'CALLE 1 CASA 2',
            'condicion_vivienda_id': cond.condicion,
        },
        5,
        POBLACION_ACTIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'municipio' in det.lower()

    # Falla sin parroquia
    st, det, _ = _analizar_fila(
        tipo_viv,
        {
            'cedula': emp.cedulaidentidad,
            'estado_id': edo.estado,
            'municipio_id': f"{mun.municipio} ({edo.estado})",
            'direccion_exacta': 'CALLE 1 CASA 2',
            'condicion_vivienda_id': cond.condicion,
        },
        5,
        POBLACION_ACTIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'parroquia' in det.lower()

    # Falla sin condición
    st, det, _ = _analizar_fila(
        tipo_viv,
        {
            'cedula': emp.cedulaidentidad,
            'estado_id': edo.estado,
            'municipio_id': f"{mun.municipio} ({edo.estado})",
            'parroquia_id': f"{par.parroquia} ({mun.municipio} - {edo.estado})",
            'direccion_exacta': 'CALLE 1 CASA 2',
        },
        5,
        POBLACION_ACTIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'condición' in det.lower()

    # Pasa con todos los obligatorios
    st, det, _ = _analizar_fila(
        tipo_viv,
        {
            'cedula': emp.cedulaidentidad,
            'estado_id': edo.estado,
            'municipio_id': f"{mun.municipio} ({edo.estado})",
            'parroquia_id': f"{par.parroquia} ({mun.municipio} - {edo.estado})",
            'codigo_postal': cp.codigo,
            'direccion_exacta': 'CALLE 1 CASA 2',
            'condicion_vivienda_id': cond.condicion,
        },
        5,
        POBLACION_ACTIVOS,
    )
    assert st in (CargaMasivaFilaModel.Estado.ACTUALIZAR, CargaMasivaFilaModel.Estado.NUEVO)


def test_vivienda_reglas_ubicacion_pasivos_exterior_y_venezuela(datos_base):
    """En PASIVOS: país obligatorio; si exterior exige ciudad_region y vacía estado/municipio/parroquia."""
    emp = datos_base['empleado']
    edo = datos_base['estado_falcon']
    mun = datos_base['municipio_miranda_falcon']
    par = datos_base['parroquia_san_antonio_falcon']
    cond = datos_base['condicion_vivienda']
    pais_ve = datos_base['pais_venezuela']
    pais_es = datos_base['pais_espana']
    tipo_viv = TIPOS_POR_CLAVE['vivienda']

    # 1. Falla si no indica país en pasivos
    st, det, _ = _analizar_fila(
        tipo_viv,
        {
            'cedula': emp.cedulaidentidad,
            'direccion_exacta': 'AVENIDA CENTRAL 45',
            'condicion_vivienda_id': cond.condicion,
        },
        5,
        POBLACION_PASIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'país' in det.lower()

    # 2. Residencia en exterior (ESPAÑA): falla sin ciudad_region
    st, det, _ = _analizar_fila(
        tipo_viv,
        {
            'cedula': emp.cedulaidentidad,
            'pais_id': pais_es.nombre,
            'direccion_exacta': 'CALLE MAYOR 12, PISO 3',
            'condicion_vivienda_id': cond.condicion,
        },
        5,
        POBLACION_PASIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'ciudad o región' in det.lower()

    # 3. Residencia en exterior: si envía estado venezolano, se rechaza
    st, det, _ = _analizar_fila(
        tipo_viv,
        {
            'cedula': emp.cedulaidentidad,
            'pais_id': pais_es.nombre,
            'ciudad_region': 'MADRID',
            'estado_id': edo.estado,
            'direccion_exacta': 'CALLE MAYOR 12, PISO 3',
            'condicion_vivienda_id': cond.condicion,
        },
        5,
        POBLACION_PASIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'exterior' in det.lower() and 'vacíos' in det.lower()

    # 4. Residencia en exterior válida y aplicación en BD
    st, det, _ = _analizar_fila(
        tipo_viv,
        {
            'cedula': emp.cedulaidentidad,
            'pais_id': pais_es.nombre,
            'ciudad_region': 'MADRID',
            'direccion_exacta': 'CALLE MAYOR 12, PISO 3',
            'condicion_vivienda_id': cond.condicion,
        },
        5,
        POBLACION_PASIVOS,
    )
    assert st in (CargaMasivaFilaModel.Estado.ACTUALIZAR, CargaMasivaFilaModel.Estado.NUEVO)

    carga = CargaMasivaModel.objects.create(
        archivo_nombre='viv_pasivo_ext.xlsx',
        poblacion=POBLACION_PASIVOS,
        tipos=['vivienda'],
        solicitada_por_cedula='1',
        estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    CargaMasivaFilaModel.objects.create(
        carga=carga,
        hoja='Vivienda',
        tipo='vivienda',
        numero_fila=5,
        estado=CargaMasivaFilaModel.Estado.ACTUALIZAR,
        datos={
            'cedula': emp.cedulaidentidad,
            'pais_id': pais_es.nombre,
            'ciudad_region': 'MADRID',
            'direccion_exacta': 'CALLE MAYOR 12, PISO 3',
            'condicion_vivienda_id': cond.condicion,
        },
        anteriores={},
    )
    aplicar_carga(carga, '1')
    viv = DatosViviendaModel.objects.get(empleado_id=emp.pk)
    assert viv.pais_id == pais_es.pk
    assert viv.ciudad_region == 'MADRID'
    assert viv.estado is None
    assert viv.municipio is None
    assert viv.parroquia is None

    # 5. Pasivo con País = VENEZUELA: exige estado, municipio, parroquia
    st, det, _ = _analizar_fila(
        tipo_viv,
        {
            'cedula': emp.cedulaidentidad,
            'pais_id': pais_ve.nombre,
            'direccion_exacta': 'CALLE CENTRAL 10',
            'condicion_vivienda_id': cond.condicion,
        },
        5,
        POBLACION_PASIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'estado' in det.lower()


def test_formacion_academica_obligatoriedad_nivel_y_dependencia_titulo_institucion(datos_base):
    """En formación académica: nivel es obligatorio; si hay título se exige institución."""
    emp = datos_base['empleado']
    carrera = datos_base['carrera']
    inst = datos_base['institucion']
    nivel = datos_base['nivel_academico']
    tipo_fa = TIPOS_POR_CLAVE['formacion_academica']

    # Falla sin nivel académico
    st, det, _ = _analizar_fila(
        tipo_fa,
        {'cedula': emp.cedulaidentidad, 'titulo': carrera.nombre_carrera, 'institucion': inst.nombre_institucion},
        5,
        POBLACION_ACTIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'nivel académico' in det.lower()

    # Falla si hay título pero no institución
    st, det, _ = _analizar_fila(
        tipo_fa,
        {'cedula': emp.cedulaidentidad, 'nivel_academico_id': nivel.nivelacademico, 'titulo': carrera.nombre_carrera},
        5,
        POBLACION_ACTIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'institución' in det.lower()

    # Pasa con solo nivel (ej. educación básica/secundaria sin título universitario)
    st, det, _ = _analizar_fila(
        tipo_fa,
        {'cedula': emp.cedulaidentidad, 'nivel_academico_id': nivel.nivelacademico},
        5,
        POBLACION_ACTIVOS,
    )
    assert st in (CargaMasivaFilaModel.Estado.ACTUALIZAR, CargaMasivaFilaModel.Estado.NUEVO)

    # Pasa con nivel + título + institución
    st, det, _ = _analizar_fila(
        tipo_fa,
        {
            'cedula': emp.cedulaidentidad,
            'nivel_academico_id': nivel.nivelacademico,
            'titulo': carrera.nombre_carrera,
            'institucion': inst.nombre_institucion,
        },
        5,
        POBLACION_ACTIVOS,
    )
    assert st in (CargaMasivaFilaModel.Estado.ACTUALIZAR, CargaMasivaFilaModel.Estado.NUEVO)


def test_formacion_complementaria_fechas_dependientes(datos_base):
    """En formación complementaria: si se indica una fecha se exige la otra; fecha_fin >= fecha_inicio."""
    emp = datos_base['empleado']
    inst = datos_base['institucion']
    tipo_fc = TIPOS_POR_CLAVE['formacion_complementaria']

    # Falla si solo hay fecha inicio
    st, det, _ = _analizar_fila(
        tipo_fc,
        {'cedula': emp.cedulaidentidad, 'curso': 'SEGURIDAD VIAL', 'institucion': inst.nombre_institucion, 'fecha_inicio': '2024-01-15'},
        5,
        POBLACION_ACTIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'fecha de fin' in det.lower()

    # Falla si solo hay fecha fin
    st, det, _ = _analizar_fila(
        tipo_fc,
        {'cedula': emp.cedulaidentidad, 'curso': 'SEGURIDAD VIAL', 'institucion': inst.nombre_institucion, 'fecha_fin': '2024-02-15'},
        5,
        POBLACION_ACTIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'fecha de inicio' in det.lower()

    # Falla si fecha_fin < fecha_inicio
    st, det, _ = _analizar_fila(
        tipo_fc,
        {'cedula': emp.cedulaidentidad, 'curso': 'SEGURIDAD VIAL', 'institucion': inst.nombre_institucion, 'fecha_inicio': '2024-02-15', 'fecha_fin': '2024-01-15'},
        5,
        POBLACION_ACTIVOS,
    )
    assert st == CargaMasivaFilaModel.Estado.ERROR
    assert 'mayor o igual' in det.lower()

    # Pasa con ambas fechas ordenadas
    st, det, _ = _analizar_fila(
        tipo_fc,
        {'cedula': emp.cedulaidentidad, 'curso': 'SEGURIDAD VIAL', 'institucion': inst.nombre_institucion, 'fecha_inicio': '2024-01-15', 'fecha_fin': '2024-02-15'},
        5,
        POBLACION_ACTIVOS,
    )
    assert st in (CargaMasivaFilaModel.Estado.ACTUALIZAR, CargaMasivaFilaModel.Estado.NUEVO)
