"""Cabeceras de seguridad del backend (E4)."""
from django.conf import settings


class SecurityHeadersMiddleware:
    """CSP estricta para la API, sin scripts inline; + cabeceras de navegador."""

    CSP = (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; "
        "form-action 'none'; img-src 'self' data:; style-src 'self'"
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.headers.setdefault('Content-Security-Policy', self.CSP)
        response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.headers.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'DENY')
        response.headers.setdefault('Cross-Origin-Opener-Policy', 'same-origin')
        if request.is_secure() and not settings.DEBUG:
            response.headers.setdefault(
                'Strict-Transport-Security', 'max-age=31536000; includeSubDomains'
            )
        return response
