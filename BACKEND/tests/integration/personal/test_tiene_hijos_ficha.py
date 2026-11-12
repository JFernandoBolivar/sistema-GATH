"""«¿Tiene hijos?» en la ficha: el detalle lo expone y RR. HH. lo corrige con auditoría y permiso."""
import pytest
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import DependenciaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

CEDULA = '99005566'
URL = f'/api/v1/personal/{CEDULA}/'
URL_COMP = f'/api/v1/personal/{CEDULA}/datos-complementarios/'
PASIVO = '99007788'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=()):
        self.pk = self.id = 1
        self.cedula_id = 'V-1'
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


@pytest.fixture
def trabajador():
    nac = NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})[0]
    sexo = SexoModel.objects.create(sexo='F')
    EmployeeModel.objects.create(
        cedulaidentidad=CEDULA, nombres='ANA', apellidos='PEREZ', sexoid=sexo, nacionalidad=nac,
    )
    return sexo, nac


def test_detalle_sin_dato_devuelve_null(trabajador):
    r = _cliente('personal.ver_detalle').get(URL)
    assert r.status_code == 200, r.content
    assert r.json()['data']['tiene_hijos'] is None


def test_detalle_expone_el_valor_guardado(trabajador):
    DatosComplementariosTrabajadorModel.objects.create(cedula=CEDULA, tiene_hijos=True)
    r = _cliente('personal.ver_detalle').get(URL)
    assert r.json()['data']['tiene_hijos'] is True


def test_patch_cambia_el_valor_y_audita(trabajador):
    r = _cliente('personal.editar_personales').patch(URL_COMP, {'tiene_hijos': False}, format='json')
    assert r.status_code == 200, r.content
    assert r.json()['data']['tiene_hijos'] is False
    assert DatosComplementariosTrabajadorModel.objects.get(cedula=CEDULA).tiene_hijos is False

    r = _cliente('personal.editar_personales').patch(URL_COMP, {'tiene_hijos': True}, format='json')
    assert r.status_code == 200
    log = AuditoriaLog.objects.filter(accion='personal.tiene_hijos_actualizado', recurso_id=CEDULA).order_by('-pk').first()
    assert log is not None
    assert log.estado_previo == {'tiene_hijos': False}
    assert log.estado_nuevo == {'tiene_hijos': True}


def test_patch_sin_permiso_da_403(trabajador):
    r = _cliente('personal.ver_detalle').patch(URL_COMP, {'tiene_hijos': True}, format='json')
    assert r.status_code == 403
    assert not DatosComplementariosTrabajadorModel.objects.filter(cedula=CEDULA).exists()


def test_patch_trabajador_inexistente_da_404(trabajador):
    r = _cliente('personal.editar_personales').patch(
        '/api/v1/personal/00000000/datos-complementarios/', {'tiene_hijos': True}, format='json',
    )
    assert r.status_code == 404


def test_patch_sin_campo_da_400(trabajador):
    r = _cliente('personal.editar_personales').patch(URL_COMP, {}, format='json')
    assert r.status_code == 400


def test_pasivo_detalle_y_patch_con_permiso_de_pasivos(trabajador):
    sexo, _ = trabajador
    estatus = EstatusModel.objects.create(estatus='PASIVO')
    tipo_personal = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    nomina = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)
    cargo = DenominacionCargoModel.objects.create(cargo='PERSONAL PASIVO')
    cargo_esp = DenominacionCargoEspecificoModel.objects.create(cargo='PERSONAL PASIVO')
    dep = DependenciaModel.objects.create(Codigo='NA', dependencia='NIVEL DE APOYO')
    emp = EmployeeModel.objects.create(cedulaidentidad=PASIVO, nombres='LUIS', apellidos='GOMEZ', sexoid=sexo)
    AsigTrabajoModel.objects.create(
        employee=emp, codigo='J_7788', denominacioncargoid=cargo, denominacioncargoespecificoid=cargo_esp,
        tiponominaid=nomina, estatusid=estatus, Tipo_personal=tipo_personal, Dependencia=dep,
    )
    r = _cliente('pasivos.editar').patch(
        f'/api/v1/personal/{PASIVO}/datos-complementarios/', {'tiene_hijos': True}, format='json',
    )
    assert r.status_code == 200, r.content
    r = _cliente('pasivos.ver').get(f'/api/v1/pasivos/{PASIVO}/')
    assert r.status_code == 200, r.content
    assert r.json()['data']['tiene_hijos'] is True
