"""Alta directa de pasivo: catálogos reales, permisos y movimiento de ingreso."""
import datetime

import pytest
from rest_framework.test import APIClient

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=(), pk=1):
        self.pk = self.id = pk
        self.cedula_id = 'V-1'
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    cuenta = CuentaModel.objects.order_by('pk').first()
    api.force_authenticate(user=Usuario(permisos, pk=cuenta.pk if cuenta else 1))
    return api


@pytest.fixture
def catalogos():
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'},
    )
    sexo = SexoModel.objects.create(sexo='M')
    EstatusModel.objects.create(estatus='PASIVO')
    EstatusModel.objects.create(estatus='ACTIVO')
    tipo_personal = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    nomina_pasivo = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)
    nomina_activo = TipoNominaModel.objects.create(nomina='CONTRATADO', es_activo=True)
    cargo = DenominacionCargoModel.objects.create(cargo='PERSONAL PASIVO')
    cargo_esp = DenominacionCargoEspecificoModel.objects.create(cargo='PERSONAL PASIVO')
    dep = DependenciaModel.objects.create(Codigo='NA', dependencia='NIVEL DE APOYO')
    DireccionGeneralModel.objects.create(
        Codigo='DG-GH', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dep,
    )
    TipoMovimientoModel.objects.create(movimiento='JUBILACION DE DERECHO')
    rol = RolModel.objects.create(nombre_rol='RRHH')
    operador = EmployeeModel.objects.create(
        cedulaidentidad='V-9999', nombres='Operador', apellidos='RRHH', sexoid=sexo,
    )
    CuentaModel.objects.create(cedula=operador, rol=rol, password='!')
    return {
        'sexo': sexo,
        'nomina_pasivo': nomina_pasivo,
        'nomina_activo': nomina_activo,
        'cargo': cargo,
        'cargo_esp': cargo_esp,
        'tipo_personal': tipo_personal,
    }


def _cuerpo(catalogos, cedula='V-7777', tipo_nomina=None):
    return {
        'cedula': cedula,
        'nombres': 'Ana',
        'apellidos': 'Pérez',
        'sexo_id': catalogos['sexo'].pk,
        'fecha_nacimiento': '1960-01-15',
        'tipo_nomina_id': (tipo_nomina or catalogos['nomina_pasivo']).pk,
    }


def test_registrar_pasivo_directo_crea_employee_y_asignacion(catalogos):
    respuesta = _cliente('pasivos.crear').post(
        '/api/v1/pasivos/', _cuerpo(catalogos), format='json',
    )
    assert respuesta.status_code == 201, respuesta.content
    datos = respuesta.json()['data']
    assert datos['cedula'] == 'V-7777'
    assert datos['tipo_nomina_id'] == catalogos['nomina_pasivo'].pk

    empleado = EmployeeModel.objects.get(cedulaidentidad='V-7777')
    asignacion = AsigTrabajoModel.objects.get(employee=empleado)
    assert asignacion.Tipo_personal.tipo_personal == 'PASIVO'
    assert asignacion.tiponominaid.es_activo is False
    assert asignacion.denominacioncargoid.cargo == 'PERSONAL PASIVO'
    assert asignacion.denominacioncargoespecificoid.cargo == 'PERSONAL PASIVO'
    assert asignacion.Dependencia.dependencia == 'NIVEL DE APOYO'
    assert asignacion.DireccionGeneral.direccion_general == 'OFICINA DE GESTION HUMANA'
    assert asignacion.estatusid.estatus == 'PASIVO'


def test_registrar_pasivo_directo_acepta_el_payload_anidado_del_wizard(catalogos):
    """El wizard de 7 pasos envía expediente anidado en el alta."""
    cuerpo = _cuerpo(catalogos, cedula='V-7782')
    cuerpo.update(
        {
            'perfil_salud': {
                'grupo_sanguineo_id': None,
                'alergias': [],
                'patologias_cronicas': [],
                'discapacidades': [],
            },
            'perfil_fisico': {
                'talla_camisa_id': None,
                'talla_pantalon_id': None,
                'talla_zapatos_id': None,
                'talla_chaqueta_id': None,
            },
            'formacion_academica': [],
            'formacion_complementaria': [],
            'contacto_emergencia': [],
            'antecedentes': [],
            'datos_vivienda': {},
        }
    )

    respuesta = _cliente('pasivos.crear').post(
        '/api/v1/pasivos/', cuerpo, format='json',
    )

    assert respuesta.status_code == 201, respuesta.content
    assert respuesta.json()['data']['cedula'] == 'V-7782'


def test_registrar_pasivo_directo_acepta_ids_en_las_fks_anidadas(catalogos):
    """El wizard envía IDs crudos en las FKs anidadas (bug 500 al registrar)."""
    from apps.catalogos.infrastructure.models.geografia_models import (
        EstadoModel,
        MunicipioModel,
        ParroquiaModel,
    )
    from apps.personal.infrastructure.models.catalogos_soporte_models import (
        CodigoPostalModel,
        CondicionViviendaModel,
        InstitucionModel,
        NivelAcademicoModel,
    )
    from apps.personal.infrastructure.models.expediente_models import (
        DatosViviendaModel,
        FormacionAcademicaModel,
    )

    estado = EstadoModel.objects.create(estado='DISTRITO CAPITAL')
    municipio = MunicipioModel.objects.create(municipio='LIBERTADOR', estadoid=estado)
    parroquia = ParroquiaModel.objects.create(parroquia='CATEDRAL', municipioid=municipio)
    condicion = CondicionViviendaModel.objects.create(condicion='PROPIA')
    codigo_postal = CodigoPostalModel.objects.create(codigo='1010', estado_id=estado)
    nivel = NivelAcademicoModel.objects.create(nivelacademico='UNIVERSITARIO')
    institucion = InstitucionModel.objects.create(nombre_institucion='UCV')

    cuerpo = _cuerpo(catalogos, cedula='V-7783')
    cuerpo.update(
        {
            'datos_vivienda': {
                'estado': estado.pk,
                'municipio': municipio.pk,
                'parroquia': parroquia.pk,
                'direccion_exacta': 'Av. Principal',
                'condicion_vivienda': condicion.pk,
                'codigo_postal': codigo_postal.pk,
            },
            'formacion_academica': [
                {'nivel_academico': nivel.pk, 'institucion': institucion.pk},
            ],
            'contacto_emergencia': [
                {
                    'nombres': 'Ana',
                    'apellidos': 'Pérez',
                    'telefono': '0412-1234567',
                    'relacion': None,
                },
            ],
            'antecedentes': [
                {'organismo': None, 'fecha_ingreso': '2001-01-01', 'fecha_egreso': '2005-01-01'},
            ],
        }
    )

    respuesta = _cliente('pasivos.crear').post(
        '/api/v1/pasivos/', cuerpo, format='json',
    )

    assert respuesta.status_code == 201, respuesta.content
    empleado = EmployeeModel.objects.get(cedulaidentidad='V-7783')
    vivienda = DatosViviendaModel.objects.get(empleado=empleado)
    assert vivienda.estado_id == estado.pk
    assert vivienda.municipio_id == municipio.pk
    assert vivienda.parroquia_id == parroquia.pk
    academia = FormacionAcademicaModel.objects.get(empleado=empleado)
    assert academia.nivel_academico_id == nivel.pk
    assert academia.institucion_id == institucion.pk


def test_rechaza_nomina_de_activos(catalogos):
    respuesta = _cliente('pasivos.crear').post(
        '/api/v1/pasivos/',
        _cuerpo(catalogos, cedula='V-7778', tipo_nomina=catalogos['nomina_activo']),
        format='json',
    )
    assert respuesta.status_code == 400
    assert not EmployeeModel.objects.filter(cedulaidentidad='V-7778').exists()


def test_rechaza_cedula_duplicada(catalogos):
    cuerpo = _cuerpo(catalogos, cedula='V-7779')
    api = _cliente('pasivos.crear')
    assert api.post('/api/v1/pasivos/', cuerpo, format='json').status_code == 201
    assert api.post('/api/v1/pasivos/', cuerpo, format='json').status_code == 409


def test_sin_permiso_de_crear_responde_403(catalogos):
    respuesta = _cliente('pasivos.ver').post(
        '/api/v1/pasivos/', _cuerpo(catalogos), format='json',
    )
    assert respuesta.status_code == 403


def test_actualizar_pasivo_acepta_el_mismo_payload_anidado_que_personal(catalogos):
    """A-40: los datos personales viven en Employee, no en la asignación."""
    creado = _cliente('pasivos.crear').post(
        '/api/v1/pasivos/', _cuerpo(catalogos, cedula='V-7780'), format='json',
    )
    assert creado.status_code == 201

    respuesta = _cliente('pasivos.editar').patch(
        '/api/v1/pasivos/V-7780/',
        {
            'correo': 'pasivo@example.com',
            'perfil_fisico': {
                'talla_camisa_id': None,
                'talla_pantalon_id': None,
                'talla_zapatos_id': None,
                'talla_chaqueta_id': None,
            },
            'formacion_academica': [],
            'antecedentes': [],
        },
        format='json',
    )

    assert respuesta.status_code == 200, respuesta.content
    datos = respuesta.json()['data']
    assert datos['correo'] == 'pasivo@example.com'
    assert datos['formacion_academica'] == []


def test_listado_expone_sexo_ingreso_y_filtra_por_codigo(catalogos):
    """Feedback 45: datos de la tabla de activos y filtro por código de trabajador."""
    creado = _cliente('pasivos.crear').post(
        '/api/v1/pasivos/', _cuerpo(catalogos, cedula='V-7781'), format='json',
    )
    assert creado.status_code == 201

    empleado = EmployeeModel.objects.get(cedulaidentidad='V-7781')
    asignacion = AsigTrabajoModel.objects.get(employee=empleado)
    AntecedenteServicioModel.objects.create(
        empleado=empleado, fecha_ingreso=datetime.date(2001, 3, 4),
    )

    respuesta = _cliente('pasivos.ver').get(
        '/api/v1/pasivos/', {'codigo': asignacion.codigo},
    )

    assert respuesta.status_code == 200, respuesta.content
    cuerpo = respuesta.json()['data']
    assert cuerpo['count'] == 1
    fila = cuerpo['results'][0]
    assert fila['cedula'] == 'V-7781'
    assert fila['sexo_nombre'] == 'M'
    assert fila['fecha_ingreso_organismo'] == '2001-03-04'
    assert fila['nombres'].upper() == 'ANA'
    assert fila['apellidos'].upper() == 'PÉREZ'
