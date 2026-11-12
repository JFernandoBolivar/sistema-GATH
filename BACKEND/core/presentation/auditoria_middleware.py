"""
Middleware que deja el origen de la petición disponible para la auditoría.

Guarda IP, user-agent y dispositivo en un `ContextVar` (kernel) al entrar y lo
limpia siempre al salir, para que ningún caso de uso tenga que conocer Django.
"""
from core.infrastructure.auditoria_contexto import fijar_origen, limpiar_origen
from core.presentation.audit import origen_de_peticion


class OrigenAuditoriaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        fijar_origen(origen_de_peticion(request))
        try:
            return self.get_response(request)
        finally:
            limpiar_origen()
