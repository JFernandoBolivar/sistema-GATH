"""
Sobre de respuesta unificado (Contrato C-1, B2.3, regla B9).

Toda vista de `presentation/` responde a través de `ok()` / `fail()` — nunca
con `Response(...)` construido a mano.
"""
from typing import Any

from rest_framework.response import Response


def ok(data: Any = None, message: str = 'Operación exitosa.', status: int = 200) -> Response:
    """Respuesta de éxito con el sobre C-1: {status: 'success', message, data}."""
    return Response({'status': 'success', 'message': message, 'data': data}, status=status)


def fail(message: str = 'Ha ocurrido un error.', status: int = 400, data: Any = None) -> Response:
    """
    Respuesta de error con el sobre C-1: {status: 'error', message, data}.

    `message` debe ser siempre un texto seguro para el usuario final (regla S6):
    el detalle técnico se correlaciona por `trace_id` en `auditoria_log` y en
    `errors_backend.txt`, nunca en el payload HTTP.
    """
    return Response({'status': 'error', 'message': message, 'data': data}, status=status)
