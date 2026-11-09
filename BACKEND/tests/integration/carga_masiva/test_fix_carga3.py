"""FIX-CARGA3: obligatoriedad de campos y detección de posibles duplicados."""
import datetime

import pytest

from apps.carga_masiva.domain.registro_campos import (
    POBLACION_ACTIVOS,
    POBLACION_PASIVOS,
    TIPOS_POR_CLAVE,
)
from apps.carga_masiva.infrastructure.analisis import _analizar_fila
from apps.carga_masiva.infrastructure.aplicacion import aplicar_carga, confirmar_filas
from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel, CargaMasivaModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    NacionalidadModel,
    PaisModel,
    SexoModel,
)
from apps.catalogos.infrastructure.models.geografia_models import (
    EstadoModel,
    MunicipioModel,
    ParroquiaModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    CodigoPostalModel,
    CondicionViviendaModel,
    InstitucionModel,
    RegionTallaModel,
    TallaModel,
    TipoPrendaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalogos():
    SexoModel.objects.create(sexo='FEMENINO')
    SexoModel.objects.create(sexo='MASCULINO')
    nacionalidad = NacionalidadModel.objects.create(codigo='V', nombre='VENEZOLANO')
    EstadoCivilModel.objects.create(estadoCivil='SOLTERO')

    estado = EstadoModel.objects.create(estado='FALCÓN')
    MunicipioModel.objects.create(municipio='MIRANDA', estadoid=estado)
    ParroquiaModel.objects.create(
        parroquia='SAN ANTONIO',
        municipioid=MunicipioModel.objects.get(municipio='MIRANDA'),
    )
    CodigoPostalModel.objects.create(codigo='4101', estado_id=estado)
    CodigoPostalModel.objects.create(codigo='5001', estado_id=EstadoModel.objects.create(estado='ZULIA'))
    CondicionViviendaModel.objects.create(condicion='PROPIA')

    InstitucionModel.objects.create(nombre_institucion='UNIVERSIDAD CENTRAL DE VENEZUELA')
    OrganismoAdscritoModel.objects.create(Organismoadscrito='CONATEL')

    region = RegionTallaModel.objects.create(codigo='REG1', descripcion='NACIONAL')
    for prenda, valor in (('CAMISA', 'M'), ('PANTALON', '34'), ('ZAPATO', '42')):
        tipo = TipoPrendaModel.objects.create(categoria=prenda)
        TallaModel.objects.create(valor=valor, region=region, tipo_prenda=tipo)

    PaisModel.objects.create(codigo='VE', nombre='VENEZUELA', es_venezuela=True)
    PaisModel.objects.create(codigo='ES', nombre='ESPAÑA', es_venezuela=False)

    return {
        'nacionalidad': nacionalidad,
        'estado': estado,
        'codigo_postal': CodigoPostalModel.objects.get(codigo='4101'),
        'codigo_postal_zulia': CodigoPostalModel.objects.get(codigo='5001'),
    }


def _datos_personales(**cambios):
    datos = {
        'cedula': '81000001',
        'nombres': 'ANA',
        'apellidos': 'PEREZ',
        'sexo_id': 'FEMENINO',
        'fecha_nacimiento': '1990-01-01',
        'nacionalidad_id': 'VENEZOLANO',
        'estado_civil_id': 'SOLTERO',
    }
    datos.update(cambios)
    return datos


def _vivienda(datos_base, **cambios):
    datos = {
        'cedula': '81000001',
        'estado_id': datos_base['estado'].estado,
        'municipio_id': 'MIRANDA (FALCÓN)',
        'parroquia_id': 'SAN ANTONIO (MIRANDA - FALCÓN)',
        'codigo_postal': datos_base['codigo_postal'].codigo,
        'direccion_exacta': 'CALLE UNION CASA 12',
        'condicion_vivienda_id': 'PROPIA',
    }
    datos.update(cambios)
    return datos


def test_estado_civil_obligatorio_en_datos_personales(catalogos):
    tipo = TIPOS_POR_CLAVE['datos_personales']
    datos = _datos_personales()
    datos.pop('estado_civil_id')

    estado, detalle, _ = _analizar_fila(tipo, datos, 5, POBLACION_ACTIVOS)

    assert estado == CargaMasivaFilaModel.Estado.ERROR
    assert 'estado civil: obligatorio' in detalle.lower()


def test_tallas_obligatorias_solo_para_activos(catalogos):
    tipo = TIPOS_POR_CLAVE['salud_tallas']
    EmployeeModel.objects.create(
        cedulaidentidad='81000001', nombres='ANA', apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1),
        sexoid=SexoModel.objects.get(sexo='FEMENINO'),
        nacionalidad=catalogos['nacionalidad'],
    )
    datos = {'cedula': '81000001'}

    activo, detalle_activo, _ = _analizar_fila(tipo, datos, 5, POBLACION_ACTIVOS)
    pasivo, _, _ = _analizar_fila(tipo, datos, 5, POBLACION_PASIVOS)

    assert activo == CargaMasivaFilaModel.Estado.ERROR
    assert 'talla de camisa: obligatorio' in detalle_activo.lower()
    assert pasivo != CargaMasivaFilaModel.Estado.ERROR


def test_institucion_obligatoria_en_formacion_complementaria(catalogos):
    tipo = TIPOS_POR_CLAVE['formacion_complementaria']

    estado, detalle, _ = _analizar_fila(
        tipo,
        {'cedula': '81000001', 'curso': 'REDES'},
        5,
        POBLACION_ACTIVOS,
    )

    assert estado == CargaMasivaFilaModel.Estado.ERROR
    assert 'institución: obligatorio' in detalle.lower()


def test_fecha_egreso_obligatoria_en_antecedentes(catalogos):
    tipo = TIPOS_POR_CLAVE['antecedentes_laborales']

    estado, detalle, _ = _analizar_fila(
        tipo,
        {
            'cedula': '81000001',
            'organismo': 'CONATEL',
            'fecha_ingreso': '2020-01-15',
        },
        5,
        POBLACION_ACTIVOS,
    )

    assert estado == CargaMasivaFilaModel.Estado.ERROR
    assert 'fecha de egreso: obligatorio' in detalle.lower()


def _empleado(catalogos, cedula='81000001'):
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres='ANA', apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1),
        sexoid=SexoModel.objects.get(sexo='FEMENINO'),
        nacionalidad=catalogos['nacionalidad'],
    )


def test_codigo_postal_obligatorio_para_venezuela_y_vacio_en_exterior(catalogos):
    _empleado(catalogos)
    tipo = TIPOS_POR_CLAVE['vivienda']

    sin_cp, detalle, _ = _analizar_fila(
        tipo, _vivienda(catalogos, codigo_postal=''), 5, POBLACION_ACTIVOS,
    )
    assert sin_cp == CargaMasivaFilaModel.Estado.ERROR
    assert 'código postal: obligatorio' in detalle.lower()

    exterior = {
        'cedula': '81000001',
        'pais_id': 'ESPAÑA',
        'ciudad_region': 'MADRID',
        'codigo_postal': catalogos['codigo_postal'].codigo,
        'direccion_exacta': 'CALLE MAYOR 12',
        'condicion_vivienda_id': 'PROPIA',
    }
    con_cp_exterior, detalle_ext, _ = _analizar_fila(
        tipo, exterior, 5, POBLACION_PASIVOS,
    )
    assert con_cp_exterior == CargaMasivaFilaModel.Estado.ERROR
    assert 'debe quedar vacío' in detalle_ext.lower()

    exterior['codigo_postal'] = ''
    valido, _, _ = _analizar_fila(tipo, exterior, 5, POBLACION_PASIVOS)
    assert valido != CargaMasivaFilaModel.Estado.ERROR


def test_codigo_postal_debe_corresponder_al_estado(catalogos):
    _empleado(catalogos)
    tipo = TIPOS_POR_CLAVE['vivienda']

    estado, detalle, _ = _analizar_fila(
        tipo,
        _vivienda(catalogos, codigo_postal=catalogos['codigo_postal_zulia'].codigo),
        5,
        POBLACION_ACTIVOS,
    )

    assert estado == CargaMasivaFilaModel.Estado.ERROR
    assert 'no corresponde al estado' in detalle.lower()


def test_posible_duplicado_requiere_confirmacion(catalogos):
    existente = EmployeeModel.objects.create(
        cedulaidentidad='81000009', nombres='ANA', apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1),
        sexoid=SexoModel.objects.get(sexo='FEMENINO'),
        nacionalidad=catalogos['nacionalidad'],
    )
    tipo = TIPOS_POR_CLAVE['datos_personales']

    estado, detalle, anteriores = _analizar_fila(
        tipo, _datos_personales(cedula='81000001'), 5, POBLACION_ACTIVOS,
    )

    assert estado == CargaMasivaFilaModel.Estado.POSIBLE_DUPLICADO
    assert f'cédula {existente.cedulaidentidad}' in detalle
    assert anteriores['duplicado_cedula'] == existente.cedulaidentidad

    datos = _datos_personales(cedula='81000001')
    carga = CargaMasivaModel.objects.create(
        archivo_nombre='duplicado.xlsx', poblacion=POBLACION_ACTIVOS,
        tipos=['datos_personales'], solicitada_por_cedula='1',
        estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    fila = CargaMasivaFilaModel.objects.create(
        carga=carga, hoja='Datos personales', tipo='datos_personales',
        numero_fila=5, estado=CargaMasivaFilaModel.Estado.POSIBLE_DUPLICADO,
        datos=datos, anteriores=anteriores,
    )

    aplicar_carga(carga, '1')
    assert not EmployeeModel.objects.filter(cedulaidentidad='81000001').exists()

    carga.estado = CargaMasivaModel.Estado.ANALIZADA
    carga.save(update_fields=['estado'])
    confirmar_filas(carga, [str(fila.id)], '1', None)
    aplicar_carga(carga, '1')

    assert EmployeeModel.objects.filter(cedulaidentidad='81000001').exists()
