"""
Servicio central de auditoria.

log_event() escribe SIEMPRE en dos lugares:
1. La tabla audit_log (USER.models.AuditLog), para consultas desde la app.
2. El archivo de texto plano configurado en LOGGING (logger "audit"),
   para revision rapida sin necesidad de acceso a la base de datos.

Un fallo al escribir en la base de datos nunca debe romper la peticion que
disparo el evento de auditoria, por eso el bloque try/except alrededor del
AuditLog.objects.create().
"""

import logging

logger = logging.getLogger("audit")


def _extraer_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _actor_repr(actor):
    if actor is None:
        return ""
    correo = getattr(actor, "correo", None)
    if correo:
        return correo
    cedula = getattr(actor, "cedula_id", None)
    return str(cedula) if cedula else str(actor)


def log_event(
    action,
    actor=None,
    entity="",
    entity_id="",
    detail="",
    level="INFO",
    source="backend",
    request=None,
):
    from USER.models.audit_models import AuditLog

    ip = _extraer_ip(request)
    actor_repr = _actor_repr(actor)

    try:
        AuditLog.objects.create(
            actor=actor if getattr(actor, "pk", None) else None,
            actor_repr=actor_repr,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id else "",
            detail=detail,
            ip_address=ip,
            level=level,
            source=source,
        )
    except Exception:
        logger.exception("No se pudo guardar el registro de auditoria en la base de datos")

    log_line = (
        f"action={action} level={level} source={source} actor={actor_repr} "
        f"entity={entity} entity_id={entity_id} ip={ip} detail={detail}"
    )
    if level == "ERROR":
        logger.error(log_line)
    elif level == "WARNING":
        logger.warning(log_line)
    else:
        logger.info(log_line)
