"""Sugerencias de cargo/oficina para las reglas de color del diseñador."""
import datetime

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_comun import (
    cargo_y_departamento,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

URL = '/api/v1/carnetizacion/reglas-color/sugerencias/'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=('carnetizacion.disenar',)):
        self.pk = 1
        self.id = None
        self.cedula_id = '1'
        self.rol_id = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos or ('carnetizacion.disenar',)))
    return api


@pytest.fixture
def escenario():
    sexo = SexoModel.objects.create(sexo='MASCULINO')
    nacionalidad = NacionalidadModel.objects.create(codigo='V', nombre='VENEZOLANO')
    estatus_activo = EstatusModel.objects.create(estatus='ACTIVO')
    estatus_vacante = EstatusModel.objects.create(estatus='VACANTE')
    tipo_personal = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='OBREROS', es_activo=True)
    denominacion = DenominacionCargoModel.objects.get_or_create(cargo='ANALISTA')[0]
    especifica = DenominacionCargoEspecificoModel.objects.get_or_create(cargo='ANALISTA I')[0]
    dependencia = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    direccion = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='GESTION HUMANA', dependenciaId=dependencia,
    )
    return {
        'sexo': sexo,
        'nacionalidad': nacionalidad,
        'estatus_activo': estatus_activo,
        'estatus_vacante': estatus_vacante,
        'tipo_personal': tipo_personal,
        'nomina': nomina,
        'denominacion': denominacion,
        'especifica': especifica,
        'direccion': direccion,
    }


def _empleado(cedula: str, escenario) -> EmployeeModel:
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula,
        nombres='ANA',
        apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1),
        sexoid=escenario['sexo'],
        nacionalidad=escenario['nacionalidad'],
        total_anos_apn=0,
    )


_SIN_DIRECCION = object()


def _asignacion(empleado, escenario, *, cargo=None, direccion=_SIN_DIRECCION, estatus=None, codigo='A1'):
    direccion_final = escenario['direccion'] if direccion is _SIN_DIRECCION else direccion
    return AsigTrabajoModel.objects.create(
        codigo=codigo,
        employee=empleado,
        denominacioncargoid=cargo or escenario['denominacion'],
        denominacioncargoespecificoid=escenario['especifica'],
        tiponominaid=escenario['nomina'],
        estatusid=estatus or escenario['estatus_activo'],
        Tipo_personal=escenario['tipo_personal'],
        DireccionGeneral=direccion_final,
    )


def test_devuelve_cargos_y_oficinas_del_ultimo_cargo_activo(escenario):
    # A: el cargo viejo no cuenta; manda el más reciente.
    a = _empleado('V-10000001', escenario)
    viejo = _asignacion(a, escenario, cargo=DenominacionCargoModel.objects.get_or_create(cargo='SECRETARIA')[0])
    AsigTrabajoModel.objects.filter(pk=viejo.pk).update(
        fecha_actualizacion=timezone.now() - datetime.timedelta(days=30),
    )
    nuevo = _asignacion(a, escenario, codigo='A2')

    # B: mismo cargo, otra oficina.
    b = _empleado('V-10000002', escenario)
    direccion_b = DireccionGeneralModel.objects.create(
        Codigo='DG2', direccion_general='OFICINA DE GESTION HUMANA',
        dependenciaId=escenario['direccion'].dependenciaId,
    )
    _asignacion(b, escenario, direccion=direccion_b, codigo='A3')

    # C: el último cargo está VACANTE: no entra.
    c = _empleado('V-10000003', escenario)
    _asignacion(c, escenario, estatus=escenario['estatus_vacante'], codigo='A4')

    # D: activo sin dirección general: solo su cargo.
    d = _empleado('V-10000004', escenario)
    _asignacion(
        d, escenario,
        cargo=DenominacionCargoModel.objects.create(cargo='DIRECTOR'),
        direccion=None, codigo='A5',
    )

    # E: su último cargo está VACANTE; el cargo activo anterior ya no cuenta
    # (el PDF también usa el último, así que no se sugiere ese texto viejo).
    e = _empleado('V-10000008', escenario)
    _asignacion(
        e, escenario,
        cargo=DenominacionCargoModel.objects.get_or_create(cargo='SECRETARIA')[0],
        codigo='A8',
    )
    _asignacion(e, escenario, estatus=escenario['estatus_vacante'], codigo='A9')

    respuesta = _cliente().get(URL)

    assert respuesta.status_code == 200, respuesta.content
    data = respuesta.json()['data']
    assert data['cargos'] == ['ANALISTA', 'DIRECTOR']
    assert data['oficinas'] == ['GESTION HUMANA', 'OFICINA DE GESTION HUMANA']

    # El texto coincide con el que usa el PDF para el último cargo de A.
    nuevo.refresh_from_db()
    cargo_pdf, oficina_pdf = cargo_y_departamento(nuevo)
    assert cargo_pdf.strip().upper() in data['cargos']
    assert oficina_pdf.strip().upper() in data['oficinas']


def test_sin_permiso_de_diseno_es_403():
    assert _cliente('carnetizacion.ver').get(URL).status_code == 403


def test_con_datos_vacios_no_devuelve_cadenas_vacias(escenario):
    empleado = _empleado('V-10000005', escenario)
    vacio = DenominacionCargoModel.objects.create(cargo='  ')
    _asignacion(empleado, escenario, cargo=vacio)

    data = _cliente().get(URL).json()['data']

    assert data == {'cargos': [], 'oficinas': ['GESTION HUMANA']}


def test_deduplica_variantes_que_el_resolutor_compara_igual(escenario):
    # `normalizar_clave` quita acentos y unifica espacios/guiones: dos variantes
    # del mismo cargo no deben generar dos reglas.
    a = _empleado('V-10000006', escenario)
    _asignacion(a, escenario, codigo='A6')
    b = _empleado('V-10000007', escenario)
    _asignacion(
        b, escenario,
        cargo=DenominacionCargoModel.objects.create(cargo='ANALÍSTA'),
        codigo='A7',
    )

    cargos = _cliente().get(URL).json()['data']['cargos']

    assert len(cargos) == 1
    assert cargos[0] in ('ANALISTA', 'ANALÍSTA')
