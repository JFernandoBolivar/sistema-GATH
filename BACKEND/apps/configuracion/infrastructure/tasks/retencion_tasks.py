"""
Tarea de retención de datos operativos (E5).

Purga únicamente datos derivados: evidencias de fe de vida, soportes de
autogestión, notificaciones leídas y correo saliente enviado/fallido. Nunca
toca `AuditoriaLog` ni `ConstanciaFeDeVidaModel`. Los plazos se leen de
Administración → Configuración y cada ejecución deja un registro de auditoría.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from celery import shared_task

from apps.autogestion.infrastructure.models.actualizacion_models import SoporteDocumentalModel
from core.domain.configuracion import (
    CLAVE_RETENCION_EVIDENCIAS_DIAS,
    CLAVE_RETENCION_NOTIFICACIONES_DIAS,
    CLAVE_RETENCION_OUTBOX_DIAS,
    CLAVE_RETENCION_SOPORTES_DIAS,
)
from apps.fe_de_vida.infrastructure.models.solicitud_models import SolicitudFeDeVidaModel
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel
from core.infrastructure.providers import obtener_lector_configuracion
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.presentation.audit import registrar_auditoria

logger = logging.getLogger('gath.tasks')

DEFECTOS = {
    CLAVE_RETENCION_EVIDENCIAS_DIAS: 365,
    CLAVE_RETENCION_SOPORTES_DIAS: 365,
    CLAVE_RETENCION_NOTIFICACIONES_DIAS: 180,
    CLAVE_RETENCION_OUTBOX_DIAS: 90,
}


def _dias(clave: str) -> int:
    lector = obtener_lector_configuracion()
    if lector is None:
        return DEFECTOS[clave]
    try:
        return max(1, lector.obtener_entero(clave))
    except Exception:  # noqa: BLE001 - un parámetro roto no detiene la purga
        return DEFECTOS[clave]


def _purgar_evidencias(limite: datetime, almacen: SeaweedFSStorage) -> int:
    total = 0
    qs = SolicitudFeDeVidaModel.objects.filter(
        evidencia_clave__gt='', created_at__lt=limite,
    ).only('id', 'evidencia_clave', 'evidencias_previas')
    for solicitud in qs.iterator():
        claves = [solicitud.evidencia_clave, *(solicitud.evidencias_previas or [])]
        try:
            for clave in filter(None, claves):
                almacen.eliminar(clave)
        except Exception as exc:  # noqa: BLE001 - si el almacén falla, no se borra el puntero
            logger.warning(
                'retencion.evidencia.omitida',
                extra={'solicitud': str(solicitud.pk), 'error': str(exc)[:200]},
            )
            continue
        SolicitudFeDeVidaModel.objects.filter(pk=solicitud.pk).update(
            evidencia_clave='', evidencias_previas=[], metadatos_captura={},
        )
        total += 1
    return total


def _purgar_soportes(limite: datetime, almacen: SeaweedFSStorage) -> int:
    total = 0
    for soporte in SoporteDocumentalModel.objects.filter(created_at__lt=limite).iterator():
        try:
            almacen.eliminar(soporte.clave_s3)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                'retencion.soporte.omitido',
                extra={'soporte': str(soporte.pk), 'error': str(exc)[:200]},
            )
            continue
        SoporteDocumentalModel.objects.filter(pk=soporte.pk).delete()
        total += 1
    return total


def _purgar_outbox(limite: datetime, almacen: SeaweedFSStorage) -> int:
    total = 0
    estados = (EventoOutboxModel.Estado.ENVIADO, EventoOutboxModel.Estado.FALLIDO)
    for evento in EventoOutboxModel.objects.filter(
        estado__in=estados, created_at__lt=limite,
    ).iterator():
        adjuntos = (evento.payload or {}).get('adjuntos') or []
        try:
            for adjunto in adjuntos:
                clave = adjunto.get('clave_almacen') if isinstance(adjunto, dict) else None
                if clave:
                    almacen.eliminar(clave)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                'retencion.outbox.omitido',
                extra={'outbox': str(evento.pk), 'error': str(exc)[:200]},
            )
            continue
        EventoOutboxModel.objects.filter(pk=evento.pk).delete()
        total += 1
    return total


def _purgar_notificaciones(limite: datetime) -> int:
    borradas, _ = NotificacionModel.objects.filter(
        leida=True, created_at__lt=limite,
    ).delete()
    return borradas


@shared_task(name='configuracion.purgar_retencion', acks_late=True)
def purgar_retencion() -> dict:
    ahora = datetime.now(timezone.utc)
    almacen = SeaweedFSStorage()
    resultado = {
        'evidencias': _purgar_evidencias(
            ahora - timedelta(days=_dias(CLAVE_RETENCION_EVIDENCIAS_DIAS)), almacen,
        ),
        'soportes': _purgar_soportes(
            ahora - timedelta(days=_dias(CLAVE_RETENCION_SOPORTES_DIAS)), almacen,
        ),
        'notificaciones': _purgar_notificaciones(
            ahora - timedelta(days=_dias(CLAVE_RETENCION_NOTIFICACIONES_DIAS)),
        ),
        'outbox': _purgar_outbox(
            ahora - timedelta(days=_dias(CLAVE_RETENCION_OUTBOX_DIAS)), almacen,
        ),
    }
    registrar_auditoria(
        trace_id=uuid.uuid4().hex,
        actor_id=None,
        actor_cedula='',
        actor_rol='SISTEMA',
        accion='configuracion.retencion_aplicada',
        modulo='configuracion',
        recurso_tipo='retencion',
        estado_nuevo=resultado,
    )
    logger.info('configuracion.retencion_aplicada', extra=resultado)
    return resultado
