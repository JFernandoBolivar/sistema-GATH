"""
Middleware de traza de extremo a extremo (E3).

Toma `X-Trace-Id` o `X-Request-ID` del cliente (el frontend ya envía
`X-Trace-Id`) o genera uno; lo deja en `request.trace_id`, en el contexto de
logging y en la respuesta. Así la auditoría, los errores y las líneas JSON de
Django comparten el mismo identificador.
"""
import uuid

from core.infrastructure.logging.trace_context import reset_trace_id, set_trace_id

CABECERAS_ENTRADA = ('HTTP_X_TRACE_ID', 'HTTP_X_REQUEST_ID')


class TraceIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        trace_id = ''
        for cabecera in CABECERAS_ENTRADA:
            valor = (request.META.get(cabecera) or '').strip()
            if valor:
                trace_id = valor[:64]
                break
        trace_id = trace_id or uuid.uuid4().hex
        request.trace_id = trace_id
        token = set_trace_id(trace_id)
        try:
            response = self.get_response(request)
        finally:
            reset_trace_id(token)
        response.headers.setdefault('X-Request-ID', trace_id)
        return response
