"""
Exportaciones asíncronas: solicitud, ejecución del worker, estado, descarga
autenticada (solo el dueño), errores, expiración y limpieza.

El almacén y la cola son dobles en memoria: no hay SeaweedFS ni RabbitMQ en las
pruebas. El generador de archivos es el real (bitácora de auditoría).
"""
import datetime

import pytest
from rest_framework.test import APIClient

from apps.auditoria.domain.value_objects.permisos import PERMISO_EXPORTAR
from apps.exportaciones.application.use_cases import gestionar_exportaciones as uc
from apps.exportaciones.domain.entities.trabajo_exportacion import EstadoExportacion
from apps.exportaciones.infrastructure.auditor import auditor_de_tarea
from apps.exportaciones.infrastructure.generadores import GeneradorExportacionDjango
from apps.exportaciones.infrastructure.models.trabajo_exportacion_model import TrabajoExportacionModel
from apps.exportaciones.infrastructure.repositories.repo_exportaciones_orm import RepoExportacionesORM
from core.domain.exceptions import (
    AlmacenamientoNoDisponible,
    ColaTareasNoDisponible,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

AHORA = datetime.datetime(2026, 11, 4, 12, 0, tzinfo=datetime.timezone.utc)
BASE = '/api/v1/exportaciones/'


class AlmacenFalso:
    def __init__(self, falla=False):
        self.objetos = {}
        self.falla = falla

    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        if self.falla:
            raise AlmacenamientoNoDisponible('caído')
        self.objetos[clave] = contenido
        return clave

    def descargar_flujo(self, clave, tamano_bloque=65536):
        yield self.objetos[clave]

    def eliminar(self, clave):
        self.objetos.pop(clave, None)


class ColaFalsa:
    def __init__(self, cae=False):
        self.encoladas = []
        self.cae = cae

    def encolar(self, nombre_tarea, **kwargs):
        if self.cae:
            raise ColaTareasNoDisponible('sin broker')
        self.encoladas.append((nombre_tarea, kwargs))
        return 'tarea-1'


class GeneradorQueFalla:
    def __init__(self, exc):
        self.exc = exc

    def generar(self, tipo, formato, parametros, progreso):
        raise self.exc


def _auditor(*args):
    return None


def _solicitar(repo=None, cola=None, solicitante=1, formato='pdf', tipo='auditoria', max_activas=3, filtros=None):
    repo = repo or RepoExportacionesORM()
    return uc.solicitar_exportacion(
        repo, cola or ColaFalsa(), _auditor,
        solicitante_id=solicitante, solicitante_cedula='V1', tipo=tipo, formato=formato,
        parametros={'filtros': filtros or {}}, ahora=AHORA, ttl_horas=24, max_activas=max_activas,
    )


def _ejecutar(trabajo, almacen, generador=None):
    return uc.ejecutar_exportacion(
        RepoExportacionesORM(), generador or GeneradorExportacionDjango(), almacen, _auditor,
        trabajo.id, lambda: AHORA,
    )


def test_solicitar_crea_trabajo_pendiente_y_lo_encola():
    cola = ColaFalsa()
    trabajo = _solicitar(cola=cola)

    assert trabajo.estado == EstadoExportacion.PENDIENTE
    assert cola.encoladas == [('exportaciones.generar', {'trabajo_id': trabajo.id})]
    fila = TrabajoExportacionModel.objects.get(pk=trabajo.id)
    assert fila.task_id == 'tarea-1'
    assert fila.expira_en == AHORA + datetime.timedelta(hours=24)


def test_tipo_o_formato_invalidos_se_rechazan():
    with pytest.raises(ValidationError):
        _solicitar(tipo='cualquier_cosa')
    with pytest.raises(ValidationError):
        _solicitar(formato='docx')


def test_sin_cola_el_trabajo_queda_en_error_y_se_propaga_el_503():
    repo = RepoExportacionesORM()
    with pytest.raises(ColaTareasNoDisponible):
        _solicitar(repo=repo, cola=ColaFalsa(cae=True))
    fila = TrabajoExportacionModel.objects.get()
    assert fila.estado == 'ERROR'
    assert 'no está disponible' in fila.error


def test_tope_de_exportaciones_activas_por_usuario():
    _solicitar(max_activas=2)
    _solicitar(max_activas=2)
    with pytest.raises(ConflictError):
        _solicitar(max_activas=2)
    # Otro usuario no se ve afectado.
    assert _solicitar(solicitante=2, max_activas=2).estado == EstadoExportacion.PENDIENTE


def test_el_worker_genera_sube_y_deja_listo_con_clave_no_adivinable():
    for formato, firma in (('pdf', b'%PDF'), ('excel', b'PK')):
        almacen = AlmacenFalso()
        trabajo = _solicitar(formato=formato)
        assert _ejecutar(trabajo, almacen) == EstadoExportacion.LISTO

        listo = RepoExportacionesORM().obtener(trabajo.id)
        assert listo.estado == EstadoExportacion.LISTO and listo.progreso == 100
        assert listo.clave_archivo.startswith(f'exportaciones/{trabajo.id}/')
        assert len(listo.clave_archivo.rsplit('/', 1)[1]) > 40
        assert almacen.objetos[listo.clave_archivo].startswith(firma)
        assert listo.nombre_archivo.endswith('.pdf' if formato == 'pdf' else '.xlsx')
        assert listo.tamano_bytes == len(almacen.objetos[listo.clave_archivo])
        assert 'limite' in listo.metadatos


def test_dos_trabajos_no_comparten_clave():
    almacen = AlmacenFalso()
    a, b = _solicitar(), _solicitar()
    _ejecutar(a, almacen)
    _ejecutar(b, almacen)
    repo = RepoExportacionesORM()
    assert repo.obtener(a.id).clave_archivo != repo.obtener(b.id).clave_archivo


def test_ejecutar_dos_veces_no_regenera():
    almacen = AlmacenFalso()
    trabajo = _solicitar()
    _ejecutar(trabajo, almacen)
    assert _ejecutar(trabajo, almacen) == EstadoExportacion.LISTO
    assert len(almacen.objetos) == 1


def test_error_de_generacion_deja_error_con_mensaje():
    trabajo = _solicitar()
    estado = _ejecutar(trabajo, AlmacenFalso(), GeneradorQueFalla(ValidationError('Filtro inválido.')))
    assert estado == EstadoExportacion.ERROR
    assert RepoExportacionesORM().obtener(trabajo.id).error == 'Filtro inválido.'

    otro = _solicitar()
    _ejecutar(otro, AlmacenFalso(), GeneradorQueFalla(RuntimeError('detalle interno')))
    mensaje = RepoExportacionesORM().obtener(otro.id).error
    assert mensaje == uc.MENSAJE_GENERICO and 'interno' not in mensaje


def test_almacen_caido_se_propaga_para_reintentar_sin_marcar_error():
    trabajo = _solicitar()
    with pytest.raises(AlmacenamientoNoDisponible):
        _ejecutar(trabajo, AlmacenFalso(falla=True))
    assert RepoExportacionesORM().obtener(trabajo.id).estado == EstadoExportacion.EN_PROCESO
    # El reintento (misma tarea) sí puede continuar y terminar.
    assert _ejecutar(trabajo, AlmacenFalso()) == EstadoExportacion.LISTO


def test_solo_el_dueno_consulta_y_descarga():
    almacen = AlmacenFalso()
    trabajo = _solicitar(solicitante=1)
    repo = RepoExportacionesORM()
    with pytest.raises(ConflictError):
        uc.obtener_descarga(repo, almacen, trabajo.id, 1, AHORA)  # aún pendiente
    _ejecutar(trabajo, almacen)

    assert uc.consultar_exportacion(repo, trabajo.id, 1).id == trabajo.id
    with pytest.raises(NotFoundError):
        uc.consultar_exportacion(repo, trabajo.id, 2)
    with pytest.raises(NotFoundError):
        uc.obtener_descarga(repo, almacen, trabajo.id, 2, AHORA)
    entidad, flujo = uc.obtener_descarga(repo, almacen, trabajo.id, 1, AHORA)
    assert b''.join(flujo).startswith(b'%PDF')


def test_descarga_vencida_o_con_error_es_409():
    repo = RepoExportacionesORM()
    almacen = AlmacenFalso()
    trabajo = _solicitar()
    _ejecutar(trabajo, almacen)
    with pytest.raises(ConflictError):
        uc.obtener_descarga(repo, almacen, trabajo.id, 1, AHORA + datetime.timedelta(hours=25))

    fallido = _solicitar()
    _ejecutar(fallido, almacen, GeneradorQueFalla(ValidationError('x')))
    with pytest.raises(ConflictError):
        uc.obtener_descarga(repo, almacen, fallido.id, 1, AHORA)


def test_la_purga_borra_archivos_vencidos_cancela_atascados_y_limpia_filas():
    repo = RepoExportacionesORM()
    almacen = AlmacenFalso()
    vencido = _solicitar()
    _ejecutar(vencido, almacen)
    vigente = _solicitar()
    _ejecutar(vigente, almacen)
    TrabajoExportacionModel.objects.filter(pk=vencido.id).update(expira_en=AHORA - datetime.timedelta(minutes=1))
    atascado = _solicitar()
    TrabajoExportacionModel.objects.filter(pk=atascado.id).update(created_at=AHORA - datetime.timedelta(hours=3))
    viejo = _solicitar()
    _ejecutar(viejo, almacen, GeneradorQueFalla(ValidationError('x')))
    TrabajoExportacionModel.objects.filter(pk=viejo.id).update(created_at=AHORA - datetime.timedelta(days=30))
    clave_vencida = repo.obtener(vencido.id).clave_archivo

    resultado = uc.purgar_exportaciones(
        repo, almacen, AHORA, retencion_filas_dias=7, max_minutos_en_curso=60,
    )

    assert resultado == {'cancelados': 1, 'expirados': 1, 'filas_eliminadas': 1}
    assert clave_vencida not in almacen.objetos
    assert repo.obtener(vencido.id).estado == EstadoExportacion.EXPIRADO
    assert repo.obtener(vigente.id).estado == EstadoExportacion.LISTO
    assert repo.obtener(atascado.id).estado == EstadoExportacion.ERROR
    assert repo.obtener(viejo.id) is None


# ---------------------------------------------------------------- API

class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, pk=1):
        self.pk = self.id = pk
        self.cedula_id = f'V{pk}'
        self.rol = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(pk=1, *permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos, pk))
    return api


@pytest.fixture
def entorno(monkeypatch):
    cola, almacen = ColaFalsa(), AlmacenFalso()
    monkeypatch.setattr('apps.exportaciones.presentation.solicitud.CeleryTaskQueue', lambda: cola)
    monkeypatch.setattr(
        'apps.exportaciones.presentation.views.exportaciones_views.SeaweedFSStorage', lambda: almacen,
    )
    return cola, almacen


def test_api_flujo_completo_y_descarga_autenticada(entorno):
    cola, almacen = entorno
    api = _cliente(1, PERMISO_EXPORTAR)
    respuesta = api.get('/api/v1/auditoria/pdf/')
    assert respuesta.status_code == 202
    trabajo_id = respuesta.json()['data']['id']

    assert api.get(f'{BASE}{trabajo_id}/').json()['data']['estado'] == 'PENDIENTE'
    assert api.get(f'{BASE}{trabajo_id}/descargar/').status_code == 409

    uc.ejecutar_exportacion(
        RepoExportacionesORM(), GeneradorExportacionDjango(), almacen, auditor_de_tarea(),
        trabajo_id, lambda: AHORA,
    )
    estado = api.get(f'{BASE}{trabajo_id}/').json()['data']
    assert estado['estado'] == 'LISTO' and estado['progreso'] == 100
    assert 'clave_archivo' not in estado and 'parametros' not in estado

    descarga = api.get(f'{BASE}{trabajo_id}/descargar/')
    assert descarga.status_code == 200
    assert descarga['Content-Type'] == 'application/pdf'
    assert b''.join(descarga.streaming_content).startswith(b'%PDF')
    assert 'attachment' in descarga['Content-Disposition']

    # Otro usuario, aunque pueda exportar, no ve ni descarga el archivo ajeno.
    intruso = _cliente(2, PERMISO_EXPORTAR)
    assert intruso.get(f'{BASE}{trabajo_id}/').status_code == 404
    assert intruso.get(f'{BASE}{trabajo_id}/descargar/').status_code == 404
    # Sin sesión.
    assert APIClient().get(f'{BASE}{trabajo_id}/').status_code in (401, 403)


def test_api_audita_solicitud_y_resultado(entorno):
    cola, almacen = entorno
    api = _cliente(1, PERMISO_EXPORTAR)
    trabajo_id = api.get('/api/v1/auditoria/excel/').json()['data']['id']
    uc.ejecutar_exportacion(
        RepoExportacionesORM(), GeneradorExportacionDjango(), almacen, auditor_de_tarea(),
        trabajo_id, lambda: AHORA,
    )
    acciones = set(AuditoriaLog.objects.filter(modulo='exportaciones').values_list('accion', flat=True))
    assert acciones == {'exportacion_solicitada', 'exportacion_lista'}


def test_api_sin_broker_responde_503_claro(monkeypatch):
    monkeypatch.setattr('apps.exportaciones.presentation.solicitud.CeleryTaskQueue', lambda: ColaFalsa(cae=True))
    respuesta = _cliente(1, PERMISO_EXPORTAR).get('/api/v1/auditoria/pdf/')
    assert respuesta.status_code == 503


def test_api_id_inexistente_es_404(entorno):
    assert _cliente(1).get(f'{BASE}00000000-0000-4000-8000-000000000000/').status_code == 404
