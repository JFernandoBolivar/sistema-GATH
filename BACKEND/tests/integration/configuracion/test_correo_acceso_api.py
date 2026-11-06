"""FIX-QA10: la configuración de correo de acceso exige permisos existentes."""
import pytest
from rest_framework.test import APIClient

BASE = '/api/v1/configuracion/correo-acceso/politica/'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=()):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = '1', 1, 1, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


@pytest.mark.django_db
def test_administrador_con_configuracion_ver_puede_consultar():
    respuesta = _cliente('configuracion.ver').get(BASE)
    assert respuesta.status_code == 200, respuesta.content
    assert respuesta.json()['data']['politica_activos'] == 'institucional'


@pytest.mark.django_db
def test_sin_configuracion_ver_responde_403():
    assert _cliente().get(BASE).status_code == 403
    assert _cliente('personal.ver').get(BASE).status_code == 403


@pytest.mark.django_db
def test_actualizar_exige_configuracion_editar():
    cuerpo = {
        'politica_pasivos': 'alternativo',
        'politica_activos': 'institucional',
        'si_falta_elegido': 'dejar_sin_cuenta',
        'avisar_al_aplicar_masivo': False,
    }
    assert _cliente('configuracion.ver').put(BASE, cuerpo, format='json').status_code == 403
    assert _cliente('configuracion.editar').put(BASE, cuerpo, format='json').status_code == 200
