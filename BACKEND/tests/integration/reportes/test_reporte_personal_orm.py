"""
G3 (reporte de trabajador) sobre la BD de pruebas con el repositorio ORM real.

Verifica que los filtros que antes se ignoraban en silencio ahora filtran de
verdad, que el tope de filas es configurable y se informa (`truncado`), y que
`tipo_reporte=conteo`/`agrupar_por` se aplican.
"""
import datetime

import pytest

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    GradoModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    CategoriaDiscapacidadModel,
    DiscapacidadModel,
    GrupoSanguineoModel,
    NivelAcademicoModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    FormacionAcademicaModel,
    PerfilSaludDiscapacidad,
    PerfilSaludModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.reportes.application.use_cases.generar_reportes import generar_reporte_personal
from apps.reportes.infrastructure.repositories.repo_reportes_orm import RepoReportesORM
from core.domain.exceptions import PermissionDeniedError, ValidationError
from core.infrastructure.report_field_registry import ReportFieldRegistryORM

pytestmark = pytest.mark.django_db

HOY = datetime.date(2026, 10, 30)


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    femenino = SexoModel.objects.create(sexo='F')
    masculino = SexoModel.objects.create(sexo='M')

    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='FIJO')
    grado = GradoModel.objects.create(grado='GRADO 1')
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    cargo_especifico = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dependencia = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    direccion = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dependencia)

    grupo_sanguineo = GrupoSanguineoModel.objects.create(GrupoSanguineo='O+')
    nivel = NivelAcademicoModel.objects.create(nivelacademico='SUPERIOR')
    categoria_discapacidad = CategoriaDiscapacidadModel.objects.create(nombre_categoria='FISICA')
    discapacidad = DiscapacidadModel.objects.create(
        discapacidad='MOTORA', categoria=categoria_discapacidad)

    def crear_empleado(cedula, sexo, nacimiento, apn, con_discapacidad=False, apellidos='Apellido'):
        empleado = EmployeeModel.objects.create(
            cedulaidentidad=cedula,
            nombres=f'Nombre {cedula}',
            apellidos=apellidos,
            fecha_nacimiento=nacimiento,
            total_anos_apn=apn,
            sexoid=sexo,
        )
        AsigTrabajoModel.objects.create(
            employee=empleado,
            codigo=f'C-{cedula}',
            denominacioncargoid=cargo,
            denominacioncargoespecificoid=cargo_especifico,
            tiponominaid=nomina,
            estatusid=estatus,
            Dependencia=dependencia,
            DireccionGeneral=direccion,
            gradoid=grado,
        )
        perfil = PerfilSaludModel.objects.create(
            empleado=empleado, grupo_sanguineo=grupo_sanguineo)
        if con_discapacidad:
            PerfilSaludDiscapacidad.objects.create(
                perfil_salud=perfil, discapacidades=discapacidad)
        FormacionAcademicaModel.objects.create(empleado=empleado, nivel_academico=nivel)
        return empleado

    # 30 años, 12 años de APN, con discapacidad
    joven = crear_empleado('V100', femenino, datetime.date(1996, 6, 1), 12, con_discapacidad=True)
    # 50 años, 25 años de APN
    mayor = crear_empleado('V200', masculino, datetime.date(1976, 6, 1), 25)

    return {
        'femenino': femenino,
        'masculino': masculino,
        'nomina': nomina,
        'grado': grado,
        'cargo': cargo,
        'cargo_especifico': cargo_especifico,
        'dependencia': dependencia,
        'direccion': direccion,
        'grupo_sanguineo': grupo_sanguineo,
        'nivel': nivel,
        'discapacidad': discapacidad,
        'joven': joven,
        'mayor': mayor,
        'crear': crear_empleado,
    }


def _generar(filtros=None, hoy=HOY, limite=5000, puede_filtrar_estructura=True):
    return generar_reporte_personal(
        RepoReportesORM(),
        filtros=filtros or {},
        registro=ReportFieldRegistryORM(),
        puede_filtrar_estructura=puede_filtrar_estructura,
        limite=limite,
        hoy=hoy,
    )


def _cedulas(reporte):
    return [fila['cedula'] for fila in reporte.filas]


def test_sin_filtros_devuelve_todos(escenario):
    assert sorted(_cedulas(_generar())) == ['V100', 'V200']


def test_filtros_de_estructura_y_nomina(escenario):
    assert _cedulas(_generar({'dependencia_id': escenario['dependencia'].pk})) == ['V100', 'V200']
    assert _cedulas(_generar({'nomina_id': escenario['nomina'].pk})) == ['V100', 'V200']
    assert _cedulas(_generar({'cargo_id': escenario['cargo'].pk})) == ['V100', 'V200']
    assert _cedulas(_generar({'grado_id': escenario['grado'].pk})) == ['V100', 'V200']
    assert _generar({'dependencia_id': 999999}).filas == []


def test_filtro_por_sexo(escenario):
    assert _cedulas(_generar({'sexo_id': escenario['femenino'].pk})) == ['V100']
    assert _cedulas(_generar({'sexo_id': escenario['masculino'].pk})) == ['V200']


def test_filtro_por_edad_se_convierte_a_fecha(escenario):
    # edad_min=40 deja fuera al de 30 años
    assert _cedulas(_generar({'edad_min': 40})) == ['V200']
    # edad_max=35 deja fuera al de 50 años
    assert _cedulas(_generar({'edad_max': 35})) == ['V100']


def test_filtro_por_anios_de_apn(escenario):
    assert _cedulas(_generar({'apn_min': 20})) == ['V200']
    assert _cedulas(_generar({'apn_max': 20})) == ['V100']


def test_filtro_por_grupo_sanguineo(escenario):
    assert sorted(_cedulas(_generar({'grupo_sanguineo_id': escenario['grupo_sanguineo'].pk}))) == [
        'V100', 'V200',
    ]
    assert _generar({'grupo_sanguineo_id': 999999}).filas == []


def test_filtro_por_discapacidad(escenario):
    assert _cedulas(_generar({'discapacidad_id': escenario['discapacidad'].pk})) == ['V100']


def test_filtro_por_nivel_academico(escenario):
    assert sorted(_cedulas(_generar({'nivel_academico_id': escenario['nivel'].pk}))) == [
        'V100', 'V200',
    ]
    assert _generar({'nivel_academico_id': 999999}).filas == []


def test_filtro_por_fecha_de_ingreso(escenario):
    from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel

    AntecedenteServicioModel.objects.create(
        empleado=escenario['joven'], fecha_ingreso=datetime.date(2020, 1, 1))
    assert _cedulas(_generar({'fecha_ingreso_Desde': '2019-01-01'})) == ['V100']
    assert _generar({'fecha_ingreso_Desde': '2021-01-01'}).filas == []


def test_tope_de_filas_configurable_y_avisado(escenario):
    reporte = _generar(limite=1)

    assert reporte.total_registros == 1
    assert reporte.metadatos['total_encontrados'] == 2
    assert reporte.metadatos['limite'] == 1
    assert reporte.metadatos['truncado'] is True


def test_un_reporte_truncado_trae_los_datos_de_su_propia_pagina(escenario):
    """M5: la página truncada no pierde código ni fecha de ingreso de sus filas.

    El empleado que ordena primero por apellido se inserta al final: antes la
    subconsulta del LIMIT sin ORDER BY devolvía otra fila y la página salía con
    «S/D» y «N/A».
    """
    from apps.personal.infrastructure.models.expediente_models import (
        AntecedenteServicioModel,
    )

    alvarez = escenario['crear'](
        'V050', escenario['femenino'], datetime.date(1990, 1, 1), 5, apellidos='Alvarez'
    )
    AntecedenteServicioModel.objects.create(
        empleado=alvarez, fecha_ingreso=datetime.date(2017, 3, 1))

    reporte = _generar(limite=1)

    assert len(reporte.filas) == 1
    fila = reporte.filas[0]
    assert fila['cedula'] == 'V050'
    assert fila['codigo'] == 'C-V050'
    assert fila['fecha_ingreso'] == '01/03/2017'
    assert reporte.metadatos['truncado'] is True


def test_la_fecha_de_ingreso_es_el_reingreso_mas_reciente(escenario):
    """MEDIA 3: se muestra la fecha del último reingreso, no la del primero."""
    from apps.personal.infrastructure.models.expediente_models import (
        AntecedenteServicioModel,
    )

    joven = escenario['joven']
    AntecedenteServicioModel.objects.create(
        empleado=joven, fecha_ingreso=datetime.date(2015, 1, 1))
    AntecedenteServicioModel.objects.create(
        empleado=joven, fecha_ingreso=datetime.date(2018, 6, 1))

    fila = next(f for f in _generar().filas if f['cedula'] == 'V100')
    assert fila['fecha_ingreso'] == '01/06/2018'


def test_sin_antecedentes_la_fecha_de_ingreso_es_na(escenario):
    fila = next(f for f in _generar().filas if f['cedula'] == 'V200')
    assert fila['fecha_ingreso'] == 'N/A'


def _nueva_asignacion(escenario, empleado, codigo, estatus, actualizada_en):
    asignacion = AsigTrabajoModel.objects.create(
        employee=empleado,
        codigo=codigo,
        denominacioncargoid=escenario['cargo'],
        denominacioncargoespecificoid=escenario['cargo_especifico'],
        tiponominaid=escenario['nomina'],
        estatusid=estatus,
        Dependencia=escenario['dependencia'],
        DireccionGeneral=escenario['direccion'],
    )
    AsigTrabajoModel.objects.filter(pk=asignacion.pk).update(
        fecha_actualizacion=actualizada_en)
    return asignacion


def test_muestra_la_asignacion_activa_aunque_haya_una_mas_reciente(escenario):
    """Con varias asignaciones gana la ACTIVA, no la última creada."""
    inactivo = EstatusModel.objects.create(estatus='EGRESADO')
    joven = escenario['joven']
    activa = AsigTrabajoModel.objects.get(employee=joven)
    AsigTrabajoModel.objects.filter(pk=activa.pk).update(
        fecha_actualizacion=datetime.datetime(2020, 1, 1, tzinfo=datetime.timezone.utc))
    _nueva_asignacion(
        escenario, joven, 'C-V100-INACTIVA', inactivo,
        datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc),
    )

    fila = next(f for f in _generar().filas if f['cedula'] == 'V100')
    assert fila['codigo'] == 'C-V100'


def test_sin_asignacion_activa_usa_la_mas_reciente(escenario):
    inactivo = EstatusModel.objects.create(estatus='EGRESADO')
    mayor = escenario['mayor']
    vieja = AsigTrabajoModel.objects.get(employee=mayor)
    AsigTrabajoModel.objects.filter(pk=vieja.pk).update(
        estatusid=inactivo,
        fecha_actualizacion=datetime.datetime(2019, 1, 1, tzinfo=datetime.timezone.utc),
    )
    _nueva_asignacion(
        escenario, mayor, 'C-V200-NUEVA', inactivo,
        datetime.datetime(2025, 1, 1, tzinfo=datetime.timezone.utc),
    )

    fila = next(f for f in _generar().filas if f['cedula'] == 'V200')
    assert fila['codigo'] == 'C-V200-NUEVA'


def test_sin_tope_cuando_el_limite_es_cero(escenario):
    reporte = _generar(limite=0)

    assert reporte.total_registros == 2
    assert reporte.metadatos['truncado'] is False


def test_conteo_agrupado_por_direccion_general(escenario):
    reporte = _generar({'tipo_reporte': 'conteo', 'agrupar_por': 'direccion_general'})

    assert reporte.columnas == ['direccion_general', 'total']
    assert reporte.filas == [{'direccion_general': 'OFICINA DE GESTION HUMANA', 'total': 2}]
    assert reporte.metadatos['agrupar_por'] == 'direccion_general'


def test_conteo_por_cargo_devuelve_el_nombre_del_catalogo(escenario):
    """M3: agrupar por cargo/grado debe mostrar el texto, no el id de la FK."""
    reporte = _generar({'tipo_reporte': 'conteo', 'agrupar_por': 'cargo'})

    assert reporte.filas == [{'cargo': 'ANALISTA', 'total': 2}]

    por_grado = _generar({'tipo_reporte': 'conteo', 'agrupar_por': 'grado'})
    assert por_grado.filas == [{'grado': 'GRADO 1', 'total': 2}]

    por_especifico = _generar(
        {'tipo_reporte': 'conteo', 'agrupar_por': 'cargo_especifico'}
    )
    assert por_especifico.filas == [{'cargo_especifico': 'ANALISTA I', 'total': 2}]


def test_conteo_no_duplica_empleados_con_dos_asignaciones(escenario):
    """M2: `Count('pk', distinct=True)` cuenta empleados, no filas del join."""
    AsigTrabajoModel.objects.create(
        employee=escenario['joven'],
        codigo='C-V100-B',
        denominacioncargoid=escenario['cargo'],
        denominacioncargoespecificoid=escenario['cargo_especifico'],
        tiponominaid=escenario['nomina'],
        estatusid=EstatusModel.objects.get(estatus='ACTIVO'),
        Dependencia=escenario['dependencia'],
        DireccionGeneral=escenario['direccion'],
    )

    reporte = _generar({'tipo_reporte': 'conteo', 'agrupar_por': 'direccion_general'})

    assert reporte.filas == [{'direccion_general': 'OFICINA DE GESTION HUMANA', 'total': 2}]


def test_filtros_de_estructura_sin_permiso_dan_403(escenario):
    """M7: el caso de uso (no la vista) exige `organizacion.ver`."""
    with pytest.raises(PermissionDeniedError):
        _generar(
            {'dependencia_id': escenario['dependencia'].pk},
            puede_filtrar_estructura=False,
        )

    # Sin filtros de estructura, un usuario sin ese permiso sí obtiene el reporte.
    assert sorted(_cedulas(_generar(puede_filtrar_estructura=False))) == ['V100', 'V200']


def test_filtro_desconocido_lanza_error_de_validacion(escenario):
    with pytest.raises(ValidationError):
        _generar({'campo_inventado': '1'})


def test_un_empleado_con_dos_asignaciones_aparece_una_sola_vez(escenario):
    """Los filtros por estructura navegan `assignments`: `distinct()` evita filas repetidas."""
    joven = escenario['joven']
    AsigTrabajoModel.objects.create(
        employee=joven,
        codigo='C-V100-B',
        denominacioncargoid=escenario['cargo'],
        denominacioncargoespecificoid=escenario['cargo_especifico'],
        tiponominaid=escenario['nomina'],
        estatusid=EstatusModel.objects.get(estatus='ACTIVO'),
        Dependencia=escenario['dependencia'],
        DireccionGeneral=escenario['direccion'],
    )

    cedulas = _cedulas(_generar({'dependencia_id': escenario['dependencia'].pk}))
    assert cedulas.count('V100') == 1
    assert sorted(cedulas) == ['V100', 'V200']
