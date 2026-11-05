"""Integración de FIX-QA3: la pestaña Histórico solo ve procesos CERRADOS (todos sus estados)."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel
from apps.fe_de_vida.infrastructure.models.solicitud_models import SolicitudFeDeVidaModel

BASE = '/api/v1/fe-de-vida'
ABIERTO_PASIVO, CERRADO_PASIVO = '7500001', '7500002'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = '7500009', 1, 1, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente():
    c = APIClient()
    c.force_authenticate(user=Usuario({'fe_de_vida.ver_panel'}))
    return c


@pytest.fixture
def datos(db):
    ahora = timezone.now()
    abierto = ProcesoFeDeVidaModel.objects.create(
        nombre='Vigente 2026', fecha_apertura=ahora - timedelta(days=10),
        fecha_cierre=ahora + timedelta(days=20), estado='ABIERTO',
    )
    cerrado = ProcesoFeDeVidaModel.objects.create(
        nombre='Cerrado 2025', fecha_apertura=ahora - timedelta(days=400),
        fecha_cierre=ahora - timedelta(days=300), estado='CERRADO',
    )
    borrador = SolicitudFeDeVidaModel.objects.create(
        proceso=abierto, cedula=ABIERTO_PASIVO, estado='BORRADOR',
    )
    validad = SolicitudFeDeVidaModel.objects.create(
        proceso=cerrado, cedula=CERRADO_PASIVO, estado='VALIDADA', fecha_envio=ahora - timedelta(days=350),
    )
    return {'abierto': abierto, 'cerrado': cerrado, 'borrador': borrador, 'validad': validad}


def cuerpo(respuesta):
    return respuesta.json()['data']


def _cedulas(respuesta):
    return [f['cedula'] for f in cuerpo(respuesta)['results']]


def test_cada_pestana_ve_solo_su_proceso_y_al_cerrar_pasa_al_historico(datos):
    c = cliente()
    vigente = c.get(f'{BASE}/solicitudes/?limit=50')
    assert vigente.status_code == 200 and _cedulas(vigente) == [ABIERTO_PASIVO]
    historico = c.get(f'{BASE}/solicitudes/?historico=true&limit=50')
    assert _cedulas(historico) == [CERRADO_PASIVO]
    # El histórico del proceso cerrado incluye todos sus estados, también el borrador.
    assert cuerpo(c.get(f'{BASE}/solicitudes/?historico=true&estado=BORRADOR&limit=50'))['count'] == 0
    datos['cerrado'].estado = 'CERRADO'
    datos['cerrado'].save(update_fields=['estado'])
    SolicitudFeDeVidaModel.objects.filter(pk=datos['validad'].pk).update(estado='BORRADOR')
    assert _cedulas(c.get(f'{BASE}/solicitudes/?historico=true&estado=BORRADOR&limit=50')) == [CERRADO_PASIVO]

    # Cerrar el proceso abierto: su solicitud (aunque sea borrador) pasa al histórico.
    ProcesoFeDeVidaModel.objects.filter(pk=datos['abierto'].pk).update(estado='CERRADO')
    assert cuerpo(c.get(f'{BASE}/solicitudes/?limit=50'))['count'] == 0
    assert set(_cedulas(c.get(f'{BASE}/solicitudes/?historico=true&limit=50'))) == {
        ABIERTO_PASIVO, CERRADO_PASIVO,
    }
    borradores = _cedulas(c.get(f'{BASE}/solicitudes/?historico=true&estado=BORRADOR&limit=50'))
    assert ABIERTO_PASIVO in borradores and CERRADO_PASIVO in borradores


def test_filtro_de_proceso_en_historico_solo_acepta_cerrados(datos):
    c = cliente()
    assert cuerpo(c.get(
        f'{BASE}/solicitudes/?historico=true&proceso_id={datos["cerrado"].id}',
    ))['count'] == 1
    assert cuerpo(c.get(
        f'{BASE}/solicitudes/?historico=true&proceso_id={datos["abierto"].id}',
    ))['count'] == 0
