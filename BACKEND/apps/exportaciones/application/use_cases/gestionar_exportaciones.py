"""
Casos de uso de las exportaciones asíncronas.

- `solicitar_exportacion`: crea el trabajo y lo encola; responde de inmediato.
- `ejecutar_exportacion`: lo corre el worker (genera, sube al almacén, marca LISTO).
- `consultar_exportacion` / `obtener_descarga`: solo el solicitante (otro usuario
  recibe `NotFoundError`, igual que un id inexistente: no se revela que existe).
- `purgar_exportaciones`: borra del almacén los archivos vencidos y las filas viejas.

Sin Django ni Celery: la cola, el almacén y la auditoría llegan por puertos.
"""
import logging
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Callable, Iterator

from apps.exportaciones.domain.entities.trabajo_exportacion import (
    ESTADOS_ACTIVOS,
    EstadoExportacion,
    TrabajoExportacion,
)
from apps.exportaciones.domain.ports.generador_exportacion import GeneradorExportacion
from apps.exportaciones.domain.ports.repo_exportaciones import RepoExportaciones
from apps.exportaciones.domain.value_objects.tipos_exportacion import (
    EXTENSION,
    NOMBRE_BASE,
    TIPO_CONTENIDO,
    validar_tipo_y_formato,
)
from core.domain.exceptions import (
    AlmacenamientoNoDisponible,
    ColaTareasNoDisponible,
    ConflictError,
    DomainError,
    NotFoundError,
)
from core.domain.ports import FileStorage, TaskQueue

logger = logging.getLogger('gath.exportaciones')

TAREA_GENERAR = 'exportaciones.generar'
MENSAJE_GENERICO = 'No fue posible generar el archivo. Intente de nuevo.'

# Callback de auditoría: (accion, trabajo, detalle). Lo cablea quien conoce el contexto.
Auditor = Callable[[str, TrabajoExportacion, dict], None]


def solicitar_exportacion(
    repo: RepoExportaciones,
    cola: TaskQueue,
    auditar: Auditor,
    *,
    solicitante_id: int | None,
    solicitante_cedula: str,
    tipo: str,
    formato: str,
    parametros: dict,
    ahora: datetime,
    ttl_horas: int,
    max_activas: int,
    origen: dict | None = None,
) -> TrabajoExportacion:
    tipo, formato = validar_tipo_y_formato(tipo, formato)
    if max_activas > 0 and repo.contar_activos_de(solicitante_id) >= max_activas:
        raise ConflictError(
            'Ya tiene exportaciones en curso. Espere a que terminen antes de pedir otra.'
        )

    trabajo = repo.crear(TrabajoExportacion(
        id=str(uuid.uuid4()),
        solicitante_id=solicitante_id,
        solicitante_cedula=solicitante_cedula,
        tipo=tipo,
        formato=formato,
        estado=EstadoExportacion.PENDIENTE,
        progreso=0,
        parametros=parametros,
        creado_en=ahora,
        expira_en=ahora + timedelta(hours=ttl_horas),
    ))
    try:
        kwargs_tarea: dict = {'trabajo_id': trabajo.id}
        if origen:
            kwargs_tarea['origen'] = origen
        trabajo.task_id = cola.encolar(TAREA_GENERAR, **kwargs_tarea)
    except ColaTareasNoDisponible:
        # Sin worker no hay quien genere el archivo: el trabajo queda en ERROR y
        # el usuario recibe el 503 claro (no se simula un trabajo pendiente).
        repo.marcar_error(trabajo.id, 'El servicio de tareas en segundo plano no está disponible.', ahora)
        raise
    repo.guardar_task_id(trabajo.id, trabajo.task_id)
    auditar('exportacion_solicitada', trabajo, {'tipo': tipo, 'formato': formato})
    return trabajo


def ejecutar_exportacion(
    repo: RepoExportaciones,
    generador: GeneradorExportacion,
    almacen: FileStorage,
    auditar: Auditor,
    trabajo_id: str,
    ahora: Callable[[], datetime],
) -> EstadoExportacion | None:
    """Corre el trabajo. Es idempotente: uno ya terminado no se vuelve a generar.

    Una `AlmacenamientoNoDisponible` se propaga SIN cambiar el estado para que la
    tarea reintente; cualquier otro fallo deja el trabajo en ERROR.
    """
    trabajo = repo.obtener(trabajo_id)
    if trabajo is None:
        logger.warning('exportacion.inexistente', extra={'trabajo_id': trabajo_id})
        return None
    if not repo.marcar_en_proceso(trabajo_id, ahora()):
        return trabajo.estado

    try:
        repo.actualizar_progreso(trabajo_id, 10)
        archivo = generador.generar(
            trabajo.tipo, trabajo.formato, trabajo.parametros,
            lambda porcentaje: repo.actualizar_progreso(trabajo_id, max(10, min(int(porcentaje), 89))),
        )
        repo.actualizar_progreso(trabajo_id, 90)
        clave = clave_de_archivo(trabajo)
        almacen.subir(clave, archivo.contenido, TIPO_CONTENIDO[trabajo.formato])
        repo.marcar_listo(
            trabajo_id, clave_archivo=clave, nombre_archivo=nombre_de_archivo(trabajo, ahora()),
            tamano_bytes=len(archivo.contenido), metadatos=archivo.metadatos, ahora=ahora(),
        )
    except AlmacenamientoNoDisponible:
        raise
    except DomainError as exc:
        fallar_exportacion(repo, auditar, trabajo_id, str(exc) or MENSAJE_GENERICO, ahora())
        return EstadoExportacion.ERROR
    except Exception:
        logger.exception('exportacion.error', extra={'trabajo_id': trabajo_id})
        fallar_exportacion(repo, auditar, trabajo_id, MENSAJE_GENERICO, ahora())
        return EstadoExportacion.ERROR

    listo = repo.obtener(trabajo_id)
    if listo is not None:
        auditar('exportacion_lista', listo, {
            'tipo': listo.tipo,
            'formato': listo.formato,
            'bytes': listo.tamano_bytes,
            'total_encontrados': listo.metadatos.get('total_encontrados'),
            'truncado': listo.metadatos.get('truncado'),
        })
    return EstadoExportacion.LISTO


def fallar_exportacion(
    repo: RepoExportaciones, auditar: Auditor, trabajo_id: str, mensaje: str, ahora: datetime,
) -> None:
    repo.marcar_error(trabajo_id, mensaje, ahora)
    trabajo = repo.obtener(trabajo_id)
    if trabajo is not None:
        auditar('exportacion_fallida', trabajo, {
            'tipo': trabajo.tipo, 'formato': trabajo.formato, 'error': mensaje[:200],
        })


def consultar_exportacion(
    repo: RepoExportaciones, trabajo_id: str, solicitante_id: int | None,
) -> TrabajoExportacion:
    trabajo = repo.obtener(trabajo_id)
    if trabajo is None or trabajo.solicitante_id != solicitante_id:
        raise NotFoundError('La exportación solicitada no existe.')
    return trabajo


def obtener_descarga(
    repo: RepoExportaciones,
    almacen: FileStorage,
    trabajo_id: str,
    solicitante_id: int | None,
    ahora: datetime,
) -> tuple[TrabajoExportacion, Iterator[bytes]]:
    trabajo = consultar_exportacion(repo, trabajo_id, solicitante_id)
    if trabajo.estado in ESTADOS_ACTIVOS:
        raise ConflictError('El archivo todavía se está generando.')
    if trabajo.estado == EstadoExportacion.ERROR:
        raise ConflictError(trabajo.error or MENSAJE_GENERICO)
    if (
        trabajo.estado == EstadoExportacion.EXPIRADO
        or trabajo.expira_en <= ahora
        or not trabajo.clave_archivo
    ):
        raise ConflictError('El archivo ya expiró. Genere la exportación de nuevo.')
    return trabajo, almacen.descargar_flujo(trabajo.clave_archivo)


def purgar_exportaciones(
    repo: RepoExportaciones,
    almacen: FileStorage,
    ahora: datetime,
    *,
    retencion_filas_dias: int,
    max_minutos_en_curso: int,
    limite: int = 500,
) -> dict:
    """Limpieza periódica.

    - Cancela (ERROR) los trabajos que llevan demasiado tiempo en curso (worker caído).
    - Borra del almacén los archivos vencidos (LISTO -> EXPIRADO).
    - Elimina las filas ERROR/EXPIRADO antiguas.
    """
    cancelados = repo.marcar_atascados(ahora - timedelta(minutes=max_minutos_en_curso), ahora)
    expirados = 0
    for trabajo in repo.listar_vencidos(ahora, limite):
        try:
            almacen.eliminar(trabajo.clave_archivo)
        except DomainError:
            logger.warning('exportacion.purga_fallida', extra={'trabajo_id': trabajo.id})
            continue
        repo.marcar_expirado(trabajo.id)
        expirados += 1
    filas = repo.eliminar_antiguos(ahora - timedelta(days=retencion_filas_dias))
    return {'cancelados': cancelados, 'expirados': expirados, 'filas_eliminadas': filas}


def clave_de_archivo(trabajo: TrabajoExportacion) -> str:
    """Clave no adivinable: id del trabajo + 256 bits aleatorios; nunca datos del usuario."""
    return f'exportaciones/{trabajo.id}/{secrets.token_urlsafe(32)}.{EXTENSION[trabajo.formato]}'


def nombre_de_archivo(trabajo: TrabajoExportacion, ahora: datetime) -> str:
    return f'{NOMBRE_BASE[trabajo.tipo]}_{ahora:%Y%m%d_%H%M}.{EXTENSION[trabajo.formato]}'
