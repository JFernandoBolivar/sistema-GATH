"""U2: endpoints del restablecimiento de acceso en bloque (preview 202, 409, 202)."""
from types import SimpleNamespace

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

BASE = '/api/v1/identidad/usuarios/restablecer-acceso-bloque'
SUPERADMIN = '30799436'
CLASIFICACION = 'AMBOS'
ALCANCE = 'SIN_PRIMER_INGRESO'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula, permisos, pk=1):
        self.pk = pk
        self.id = None
        self.cedula_id = cedula
        self.rol_id = 1
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(cedula, permisos, pk=1):
    c = APIClient()
    c.force_authenticate(user=Usuario(cedula, permisos, pk))
    return c


def _cuerpo(**extra):
    cuerpo = {
        'clasificacion': CLASIFICACION, 'alcance': ALCANCE,
        'enviar_correo': True, 'motivo': 'Claves vencidas del personal',
    }
    cuerpo.update(extra)
    return cuerpo


def _preview(cliente, **extra):
    return cliente.post(f'{BASE}/preview/', _cuerpo(**extra), format='json')


@pytest.fixture
def tareas(monkeypatch):
    from apps.identidad.presentation.views import restablecer_acceso_bloque_views as vistas
    from apps.identidad.infrastructure.tasks.restablecer_acceso_bloque_tasks import (
        clave_preview,
    )

    llamadas = []

    def preview_delay(clasificacion, alcance, enviar_correo, motivo, actor):
        cache.set(clave_preview(actor['cuenta_id'], clasificacion, alcance), [1, 2, 3, 4, 5], 1800)
        return SimpleNamespace(id='preview-1')

    def ejecutar_delay(*args):
        llamadas.append(args)
        return SimpleNamespace(id='tarea-1')

    monkeypatch.setattr(vistas.restablecimiento_bloque_preview_tarea, 'delay', preview_delay)
    monkeypatch.setattr(vistas.restablecer_acceso_en_bloque_tarea, 'delay', ejecutar_delay)
    return llamadas


def test_preview_es_asincrona_y_solo_superadministrador(tareas):
    sin_permiso = _cliente('10000001', set())
    assert _preview(sin_permiso).status_code == 403

    # Tiene el permiso de Parámetros pero no es el superadministrador.
    admin_normal = _cliente('99000300', {'configuracion.editar'}, pk=2)
    assert _preview(admin_normal).status_code == 403

    superadmin = _cliente(SUPERADMIN, {'configuracion.editar'}, pk=3)
    respuesta = _preview(superadmin)
    assert respuesta.status_code == 202, respuesta.content
    assert respuesta.json()['data']['task_id'] == 'preview-1'


def test_preview_valida_el_motivo(tareas):
    superadmin = _cliente(SUPERADMIN, {'configuracion.editar'}, pk=3)
    assert _preview(superadmin, motivo='corto').status_code == 400


def test_ejecutar_exige_vista_previa_y_confirmacion(tareas):
    from apps.identidad.infrastructure.tasks.restablecer_acceso_bloque_tasks import (
        clave_preview,
    )

    superadmin = _cliente(SUPERADMIN, {'configuracion.editar'}, pk=3)
    cache.delete(clave_preview(3, CLASIFICACION, ALCANCE))
    ejecucion = _cuerpo(confirmacion=5)

    # Sin vista previa vigente.
    assert superadmin.post(f'{BASE}/', ejecucion, format='json').status_code == 409

    assert _preview(superadmin).status_code == 202
    # Confirmación distinta de la longitud de la lista.
    assert superadmin.post(f'{BASE}/', _cuerpo(confirmacion=4), format='json').status_code == 409

    respuesta = superadmin.post(f'{BASE}/', ejecucion, format='json')
    assert respuesta.status_code == 202, respuesta.content
    assert respuesta.json()['data']['task_id'] == 'tarea-1'
    assert tareas[0][5] == 5 and tareas[0][6] == [1, 2, 3, 4, 5]
    # La vista previa se consume.
    assert superadmin.post(f'{BASE}/', ejecucion, format='json').status_code == 409


def test_estado_trae_el_total_de_la_vista_previa(monkeypatch):
    from apps.identidad.presentation.views import restablecer_acceso_bloque_views as vistas

    class FakeAsync:
        state = 'SUCCESS'
        result = {
            'estado': 'LISTO', 'revisadas': 7, 'activos': 4, 'pasivos': 3,
            'total': 7, 'omitidas_administrativas': 1, 'restablecidas': 0,
            'errores': 0, 'enviar_correo': True, 'dry_run': True,
        }

    monkeypatch.setattr(vistas, 'AsyncResult', lambda task_id: FakeAsync())
    superadmin = _cliente(SUPERADMIN, {'configuracion.editar'}, pk=3)
    respuesta = superadmin.get(f'{BASE}/preview-1/')
    assert respuesta.status_code == 200, respuesta.content
    data = respuesta.json()['data']
    assert data['estado'] == 'LISTO'
    assert data['resultado']['total'] == 7


def test_estado_de_ejecucion(monkeypatch):
    from apps.identidad.presentation.views import restablecer_acceso_bloque_views as vistas

    class FakeAsync:
        state = 'SUCCESS'
        result = {'estado': 'LISTO', 'restablecidas': 5, 'errores': 0, 'total': 5}

    monkeypatch.setattr(vistas, 'AsyncResult', lambda task_id: FakeAsync())
    superadmin = _cliente(SUPERADMIN, {'configuracion.editar'}, pk=3)
    data = superadmin.get(f'{BASE}/tarea-1/').json()['data']
    assert data['estado'] == 'LISTO' and data['resultado']['restablecidas'] == 5
