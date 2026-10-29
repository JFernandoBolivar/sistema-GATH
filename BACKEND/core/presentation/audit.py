"""
Módulo de auditoría dual (B2.8, D-04, Contrato C-5).

Destino 1 — Base de Datos: inserta en `auditoria_log` (append-only).
Destino 2 — Archivo TXT: `logs/backend/audit_backend.txt` con rotación diaria,
compresión gzip y retención de 90 días, configurado en el dict `LOGGING` de
`GATH/settings.py` (B1.12). El logger 'audit_backend' emite la línea
estructurada con formato fijo de §I.4.7; el formatter añade el timestamp.
"""
import logging

from core.infrastructure.models.auditoria import AuditoriaLog

logger = logging.getLogger('audit_backend')


def origen_de_peticion(request) -> dict:
    """`ip_origen` y `user_agent` de la petición, listos para `registrar_auditoria(**...)`."""
    return {
        'ip_origen': request.META.get('REMOTE_ADDR') or None,
        'user_agent': (request.META.get('HTTP_USER_AGENT') or '')[:255],
    }


def registrar_auditoria(
    *,
    trace_id: str,
    actor_id: int | None,
    accion: str,
    modulo: str,
    resultado: str = AuditoriaLog.Resultado.SUCCESS,
    actor_cedula: str = '',
    actor_rol: str = '',
    recurso_tipo: str = '',
    recurso_id: str = '',
    ip_origen: str | None = None,
    user_agent: str = '',
    estado_previo: dict | None = None,
    estado_nuevo: dict | None = None,
) -> AuditoriaLog:
    """Implementación concreta del puerto `AuditLogger` (`core/domain/ports.py`)."""
    registro = AuditoriaLog.objects.create(
        trace_id=trace_id,
        actor_id=actor_id,
        actor_cedula=actor_cedula,
        actor_rol=actor_rol,
        modulo=modulo,
        accion=accion,
        recurso_tipo=recurso_tipo,
        recurso_id=recurso_id,
        ip_origen=ip_origen,
        user_agent=(user_agent or '')[:255],
        estado_previo=estado_previo,
        estado_nuevo=estado_nuevo,
        resultado=resultado,
    )

    logger.info(
        '[TRACE:%s] [ACTOR:%s|%s] [IP:%s] [UA:%s] [ACTION:%s.%s] [TARGET:%s#%s] [STATUS:%s]',
        trace_id, actor_cedula or actor_id, actor_rol, ip_origen or '-', (user_agent or '-')[:120],
        modulo, accion, recurso_tipo, recurso_id, resultado,
    )
    return registro
