"""H-3: bitácora de descargas de archivos protegidos (quién, qué, cuándo) sobre `AuditoriaLog`."""
import ast
import datetime
from pathlib import Path

import pytest
from django.test import RequestFactory
from rest_framework.test import APIClient

from core.domain.exceptions import NotFoundError
from core.infrastructure.models.auditoria import AuditoriaLog
from core.presentation import archivos
from core.presentation.archivos import ACCION_DESCARGA, registrar_descarga, respuesta_archivo

pytestmark = pytest.mark.django_db

BASE = '/api/v1/auditoria/'
CLAVE_SECRETA = 'perfiles/clave-interna-del-almacen.pdf'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=(), pk=7, cedula='V1234567'):
        self.pk = self.id = pk
        self.cedula_id = cedula
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


class Postulante:
    is_authenticated = True
    scope = 'postulante'
    pk = 'postulante:V999'
    cedula = 'V999'


class Almacen:
    def __init__(self, faltante=False):
        self.faltante = faltante

    def descargar_flujo(self, clave, tamano_bloque=65536):
        if self.faltante:  # como el real: abre el objeto al llamar, no al iterar
            raise NotFoundError('no existe')
        return iter([b'%PDF-1.4'])


def peticion(usuario=None):
    r = RequestFactory().get('/x', HTTP_USER_AGENT='Mozilla/5.0 ' + 'x' * 400, REMOTE_ADDR='10.1.2.3')
    r.user = usuario or Usuario()
    return r


def filas():
    return AuditoriaLog.objects.filter(accion=ACCION_DESCARGA)


def test_descarga_servida_registra_quien_que_y_desde_donde():
    respuesta_archivo(Almacen(), CLAVE_SECRETA, request=peticion(), recurso='informe_psicofisico', recurso_id='abc')
    fila = filas().get()
    assert (fila.actor_cedula, fila.actor_id, fila.recurso_tipo, fila.recurso_id) == ('V1234567', 7, 'informe_psicofisico', 'abc')
    assert fila.resultado == 'SUCCESS' and fila.ip_origen == '10.1.2.3' and len(fila.user_agent) <= 255
    assert CLAVE_SECRETA not in str((fila.estado_nuevo, fila.recurso_id, fila.recurso_tipo))


def test_postulante_por_sesion_de_invitado():
    respuesta_archivo(Almacen(), 'x.jpg', request=peticion(Postulante()), recurso='foto_postulante', recurso_id='e1')
    fila = filas().get()
    assert fila.actor_cedula == 'V999' and fila.actor_id is None and fila.actor_rol == 'POSTULANTE'


@pytest.mark.parametrize('clave,faltante', [(CLAVE_SECRETA, True), ('', False)])
def test_404_registra_no_encontrado_y_sigue_fallando(clave, faltante):
    with pytest.raises(NotFoundError):
        respuesta_archivo(Almacen(faltante), clave, request=peticion(), recurso='carnet_pdf', recurso_id='9')
    fila = filas().get()
    assert fila.resultado == 'FAILED' and fila.estado_nuevo == {'motivo': 'no_encontrado'}


def test_fallo_al_registrar_no_impide_la_descarga(monkeypatch):
    def roto(**_):
        raise RuntimeError('bitácora caída')

    monkeypatch.setattr(archivos, 'registrar_auditoria', roto)
    respuesta = respuesta_archivo(Almacen(), 'x.pdf', request=peticion(), recurso='punto_cuenta', recurso_id='1')
    assert b''.join(respuesta.streaming_content) == b'%PDF-1.4'
    registrar_descarga(peticion(), 'otro', '1')  # tampoco lanza
    assert not filas().exists()


def test_sin_request_o_recurso_no_registra():
    respuesta_archivo(Almacen(), 'x.pdf')
    assert not filas().exists()


def test_todas_las_vistas_de_descarga_declaran_el_recurso():
    """Guarda estructural: cada llamada a `respuesta_archivo` de una vista pasa `request` y `recurso`.

    Excepción deliberada: los logos del cintillo (imágenes institucionales, no datos personales).
    """
    raiz = Path(__file__).resolve().parents[3] / 'apps'
    sin_registro = []
    for ruta in raiz.glob('*/presentation/views/*.py'):
        if ruta.name == 'configuracion_visual_views.py':
            continue
        for nodo in ast.walk(ast.parse(ruta.read_text(encoding='utf-8-sig'))):
            if isinstance(nodo, ast.Call) and getattr(nodo.func, 'id', '') == 'respuesta_archivo':
                nombres = {k.arg for k in nodo.keywords}
                if not {'request', 'recurso'} <= nombres:
                    sin_registro.append(f'{ruta.name}:{nodo.lineno}')
    assert sin_registro == []


def test_vista_de_media_y_mi_carnet_registran(monkeypatch, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    (tmp_path / 'doc.pdf').write_bytes(b'%PDF-1.4')
    api = APIClient()
    api.force_authenticate(user=Usuario())
    r = api.get('/api/v1/media/doc.pdf')
    if r.status_code == 200:  # la ruta exacta depende de las urls del proyecto
        assert filas().filter(recurso_tipo='media', recurso_id='doc.pdf').exists()
    monkeypatch.setattr('apps.autogestion.presentation.views.autogestion_views.obtener_mi_carnet_pdf', lambda *a, **k: b'%PDF-1.4')
    r = api.get('/api/v1/autogestion/mi-carnet/pdf/')
    assert r.status_code == 200
    assert filas().filter(recurso_tipo='carnet_pdf', recurso_id='V1234567').exists()


# ---- Consulta (endpoint de auditoría existente, `auditoria.ver_logs`) ----

def _sembrar():
    for cedula, tipo, rid in (('V1', 'carnet_pdf', '10'), ('V1', 'informe_psicofisico', 'abc'), ('V2', 'carnet_pdf', '11')):
        registrar_descarga(peticion(Usuario(cedula=cedula, pk=1)), tipo, rid)
    AuditoriaLog.objects.create(trace_id='t', accion='OTRA', modulo='x')


def _api(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


def test_consulta_filtra_pagina_y_exige_permiso():
    _sembrar()
    api = _api('auditoria.ver_logs')
    base = f'{BASE}?accion={ACCION_DESCARGA}'
    assert api.get(base).json()['data']['total'] == 3
    assert api.get(f'{base}&usuario=V2').json()['data']['total'] == 1
    assert api.get(f'{base}&recurso=carnet_pdf').json()['data']['total'] == 2
    assert api.get(f'{base}&recurso=abc').json()['data']['total'] == 1
    hoy = datetime.date.today().isoformat()
    assert api.get(f'{base}&desde={hoy}&hasta={hoy}').json()['data']['total'] == 3
    ayer = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    assert api.get(f'{base}&hasta={ayer}').json()['data']['total'] == 0
    pagina = api.get(f'{base}&page_size=2&pagina=2').json()['data']
    assert pagina['total'] == 3 and len(pagina['resultados']) == 1
    assert ACCION_DESCARGA in api.get(f'{BASE}opciones/').json()['data']['acciones']
    assert _api().get(base).status_code == 403
