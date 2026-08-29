"""
Módulo de auditoría dual (B2.8, D-04, Contrato C-5).

Destino 1 — Base de Datos: inserta en `auditoria_log` (append-only).
Destino 2 — Archivo TXT: `logs/backend/audit_backend.txt` con rotación diaria,
compresión gzip y retención de 90 días, configurado en el dict `LOGGING` de
`SIGEP/settings.py` (B1.12). El logger 'audit_backend' emite la línea
estructurada con formato fijo de §I.4.7; el formatter añade el timestamp.
"""
import logging

from core.infrastructure.models.auditoria import AuditoriaLog

logger = logging.getLogger('audit_backend')


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
        estado_previo=estado_previo,
        estado_nuevo=estado_nuevo,
        resultado=resultado,
    )

    logger.info(
        '[TRACE:%s] [ACTOR:%s|%s] [IP:%s] [ACTION:%s.%s] [TARGET:%s#%s] [STATUS:%s]',
        trace_id, actor_cedula or actor_id, actor_rol, ip_origen or '-',
        modulo, accion, recurso_tipo, recurso_id, resultado,
    )
    return registro
