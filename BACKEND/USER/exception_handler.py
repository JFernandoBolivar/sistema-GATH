"""
Exception handler global de DRF: ademas del manejo estandar, registra en
auditoria (DB + logs/errors.log) cualquier error no controlado que llegue
a nivel de vista, con el request y el usuario autenticado si lo hay.
"""

from rest_framework.views import exception_handler

from USER.services.audit_service import log_event


def audit_exception_handler(exc, context):
    response = exception_handler(exc, context)

    request = context.get("request")
    view = context.get("view")
    actor = getattr(request, "user", None) if request is not None else None
    if actor is not None and not getattr(actor, "is_authenticated", False):
        actor = None

    # Los errores ya traducidos a una respuesta 4xx conocida (validacion,
    # permisos, autenticacion) no son "errores del sistema"; solo se
    # auditan los que DRF no supo convertir en una respuesta (500).
    if response is None:
        log_event(
            action="ERROR",
            actor=actor,
            entity=view.__class__.__name__ if view is not None else "",
            detail=f"{exc.__class__.__name__}: {exc}",
            level="ERROR",
            source="backend",
            request=request,
        )

    return response
