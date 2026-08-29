"""
Exception handler DRF centralizado (B2.4).

Traduce excepciones de dominio (`core/domain/exceptions.py`) a respuestas HTTP
con el sobre C-1, sin filtrar nunca `str(exception)` al cliente (regla S6,
ALTA-11). Se activa vía `REST_FRAMEWORK['EXCEPTION_HANDLER']` en settings.

TODO (B1.12): hoy el detalle técnico se registra con `logging.getLogger`
estándar; falta configurar el `LOGGING` dict del proyecto con el handler de
rotación hacia `logs/backend/errors_backend.txt` (D-04).

TODO (R-03, pendiente — NO ejecutar de forma mecánica): `RAC/utils/data_formatters.py::extract_first_error`
(reexportada ahora desde `core/infrastructure/error_utils.py`) todavía se usa
en ~28 call-sites de `RAC/views/*` y `AUTOGESTION/views/*` para desempaquetar
a mano `serializer.errors` y construir la respuesta de error del endpoint.
El plan (§I.2.2, R-03) la marca como "absorbida" por este exception handler,
pero portar esos 28 sitios cambia el cuerpo de error observable de cada
endpoint (pasar de un `Response({...'message': extract_first_error(...)})`
manual a que la excepción de `serializer.is_valid(raise_exception=True)` la
traduzca este handler al sobre C-1). Es un cambio de patrón de manejo de
errores, no una reubicación mecánica: se migra vista por vista cuando cada
módulo legado (`personal_activo`, `personal_pasivo`, `historial`, `family`,
`autogestion`) se porte a su `apps/[modulo]/` definitivo, no en este trabajo.
"""
import logging
import uuid

from rest_framework.views import exception_handler as drf_exception_handler

from core.domain.exceptions import (
    ConflictError,
    DomainError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError as DomainValidationError,
)
from core.presentation.envelope import fail

logger = logging.getLogger('errors_backend')

_STATUS_POR_EXCEPCION = (
    (NotFoundError, 404),
    (DomainValidationError, 400),
    (PermissionDeniedError, 403),
    (ConflictError, 409),
)


def custom_exception_handler(exc, context):
    """Handler registrado en `REST_FRAMEWORK['EXCEPTION_HANDLER']`."""
    trace_id = _obtener_trace_id(context)

    if isinstance(exc, DomainError):
        status = next(
            (codigo for tipo, codigo in _STATUS_POR_EXCEPCION if isinstance(exc, tipo)),
            400,
        )
        logger.info('[TRACE:%s] %s: %s', trace_id, type(exc).__name__, exc)
        return fail(message=str(exc), status=status)

    response = drf_exception_handler(exc, context)

    if response is None:
        # Excepción no controlada (500): el mensaje al cliente es genérico;
        # el traceback completo se correlaciona por trace_id (S6, C-5).
        logger.exception('[TRACE:%s] Error no controlado', trace_id, exc_info=exc)
        return fail(message='Ha ocurrido un error interno. Contacte a soporte.', status=500)

    # Errores estándar de DRF (403, 404, 405, etc.): se homogeneizan al sobre C-1.
    mensaje = response.data.get('detail', 'Solicitud inválida.') if isinstance(response.data, dict) else 'Solicitud inválida.'
    return fail(message=str(mensaje), status=response.status_code)


def _obtener_trace_id(context: dict) -> str:
    request = context.get('request')
    trace_id = getattr(request, 'trace_id', None) if request is not None else None
    return trace_id or str(uuid.uuid4())
