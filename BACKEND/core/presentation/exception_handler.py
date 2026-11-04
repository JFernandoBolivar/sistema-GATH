"""
Exception handler DRF centralizado (B2.4).

Traduce excepciones de dominio (`core/domain/exceptions.py`) a respuestas HTTP
con el sobre C-1, sin filtrar nunca `str(exception)` al cliente (regla S6,
ALTA-11). Se activa vía `REST_FRAMEWORK['EXCEPTION_HANDLER']` en settings.

TODO (B1.12): hoy el detalle técnico se registra con `logging.getLogger`
estándar; falta configurar el `LOGGING` dict del proyecto con el handler de
rotación hacia `logs/backend/errors_backend.txt` (D-04).

# Nota (R-03, resuelto): `core/infrastructure/error_utils.py::extract_first_error`
# se definió para absorber los ~28 call-sites del legado `RAC/views/*` y
# `AUTOGESTION/views/*`, pero ese código legado fue retirado (Fase 8) y las
# vistas de `apps/[modulo]/` usan `serializer.is_valid(raise_exception=True)`,
# cuya excepción traduce este handler al sobre C-1. `extract_first_error`
# queda como utilidad pura sin call-sites en producción y las vistas nuevas
# no lo necesitan.

"""
import logging
import uuid

from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.views import exception_handler as drf_exception_handler

from core.domain.exceptions import (
    AlmacenamientoNoDisponible,
    ColaTareasNoDisponible,
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
    (AlmacenamientoNoDisponible, 503),
    (ColaTareasNoDisponible, 503),
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
        campo = getattr(exc, 'campo', None)
        datos = {'errores': {campo: [str(exc)]}} if campo else None
        return fail(message=str(exc), status=status, data=datos)

    response = drf_exception_handler(exc, context)

    if response is None:
        # Excepción no controlada (500): el mensaje al cliente es genérico;
        # el traceback completo se correlaciona por trace_id (S6, C-5).
        logger.exception('[TRACE:%s] Error no controlado', trace_id, exc_info=exc)
        return fail(message='Ha ocurrido un error interno. Contacte a soporte.', status=500)

    # Validación de serializers: se conserva el detalle por campo en
    # `data.errores` ({'campo': ['mensaje'], 'lista.0.campo': [...]}) para que el
    # formulario marque en rojo cada dato con error (QA 2026-11-04).
    if isinstance(exc, DRFValidationError):
        errores = aplanar_errores(response.data)
        generales = errores.pop('non_field_errors', []) + errores.pop('detail', [])
        todos = [m for msgs in errores.values() for m in msgs] + generales
        if not todos:
            mensaje = 'Solicitud inválida.'
        elif len(todos) == 1:
            mensaje = todos[0]
        else:
            mensaje = f'Hay {len(todos)} datos por corregir. Revise los campos marcados en rojo.'
        return fail(message=mensaje, status=response.status_code, data={'errores': errores} if errores else None)

    # Errores estándar de DRF (403, 404, 405, etc.): se homogeneizan al sobre C-1.
    mensaje = response.data.get('detail', 'Solicitud inválida.') if isinstance(response.data, dict) else 'Solicitud inválida.'
    return fail(message=str(mensaje), status=response.status_code)


def aplanar_errores(detalle, prefijo: str = '') -> dict[str, list[str]]:
    """{'a': ['x'], 'b': [{'c': ['y']}]} -> {'a': ['x'], 'b.0.c': ['y']}."""
    salida: dict[str, list[str]] = {}
    if isinstance(detalle, dict):
        for clave, valor in detalle.items():
            ruta = f'{prefijo}.{clave}' if prefijo else str(clave)
            for k, v in aplanar_errores(valor, ruta).items():
                salida.setdefault(k, []).extend(v)
    elif isinstance(detalle, list):
        if all(not isinstance(v, (dict, list)) for v in detalle):
            if detalle:
                salida[prefijo or 'non_field_errors'] = [str(v) for v in detalle]
        else:
            for i, valor in enumerate(detalle):
                ruta = f'{prefijo}.{i}' if prefijo else str(i)
                for k, v in aplanar_errores(valor, ruta).items():
                    salida.setdefault(k, []).extend(v)
    elif detalle not in (None, ''):
        salida[prefijo or 'non_field_errors'] = [str(detalle)]
    return salida


def _obtener_trace_id(context: dict) -> str:
    request = context.get('request')
    trace_id = getattr(request, 'trace_id', None) if request is not None else None
    return trace_id or str(uuid.uuid4())
