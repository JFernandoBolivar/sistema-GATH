"""
Ayudas compartidas de las vistas de solicitudes de actualización: identidad de sesión, validación
de entrada con mensaje útil, reloj y auditoría. Las vistas no tocan el ORM (B7).
"""
import uuid
from datetime import datetime, timezone

from rest_framework.permissions import IsAuthenticated

from core.domain.exceptions import NotFoundError, ValidationError
from core.infrastructure.error_utils import extract_first_error
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.permissions import HasPermission

MODULO_AUDITORIA = 'autogestion'
RECURSO = 'SolicitudActualizacion'


def cedula_de_sesion(request) -> str:
    """Zero-IDOR: la cédula SIEMPRE sale de la sesión autenticada, nunca del cuerpo ni de la URL."""
    cedula = getattr(request.user, 'cedula_id', None)
    if not cedula:
        raise NotFoundError("El usuario autenticado no tiene un expediente de trabajador asociado.")
    return str(cedula)


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def validar_entrada(serializer_cls, data):
    """Valida y devuelve `validated_data`; los errores por campo se conservan en `data.errores`."""
    serializer = serializer_cls(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def permisos_trabajador(*codigos: str) -> list:
    """Permisos de las acciones del trabajador: sesión + permiso.

    La condición (ACTIVO/PASIVO) y las secciones permitidas las valida la política
    configurable (O12) en los casos de uso, no un guard fijo por ACTIVO.
    """
    return [IsAuthenticated, *[HasPermission(c) for c in codigos]]


def auditar(request, accion: str, solicitud_id: str, previo: dict | None = None, nuevo: dict | None = None) -> None:
    user = request.user
    rol = getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''
    registrar_auditoria(
        trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
        actor_id=getattr(user, 'pk', None), actor_cedula=str(getattr(user, 'cedula_id', '') or ''), actor_rol=rol,
        accion=accion, modulo=MODULO_AUDITORIA, recurso_tipo=RECURSO, recurso_id=str(solicitud_id),
        estado_previo=previo, estado_nuevo=nuevo, **origen_de_peticion(request),
    )


def resumen(solicitud) -> dict:
    """Estado mínimo de la solicitud para la bitácora (sin datos personales)."""
    return {'estado': solicitud.estado.value, 'version': solicitud.version}
