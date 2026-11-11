"""Autenticación por clave de API (cabecera `X-API-Key`) para sistemas integrados, p. ej. SILOG.

Las claves salen de la variable de entorno `INTEGRACION_CARNET_API_KEYS` con el formato
`sistema:clave,otro:clave2`. No hay modelo ni migración: la clave es un secreto de despliegue,
se rota cambiando la variable y no queda en la base de datos. Se compara en tiempo constante y
nunca se escribe en logs ni en la auditoría (solo el nombre del sistema).
"""
import hmac
import logging

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework.throttling import SimpleRateThrottle

logger = logging.getLogger(__name__)

CABECERA_API_KEY = 'X-API-Key'
LONGITUD_MINIMA_CLAVE = 16


class IntegracionNoConfigurada(APIException):
    status_code = 503
    default_detail = 'La integración no está disponible.'
    default_code = 'integracion_no_configurada'


class SistemaIntegrado:
    """Principal de una petición autenticada por clave de API (no es un usuario de GATH)."""
    is_authenticated = True
    is_anonymous = False

    def __init__(self, nombre: str) -> None:
        self.nombre = nombre

    def __str__(self) -> str:
        return f'sistema:{self.nombre}'


def claves_configuradas() -> dict[str, str]:
    """Interpreta `sistema:clave,...`; descarta entradas mal formadas o con clave corta."""
    crudo = getattr(settings, 'INTEGRACION_CARNET_API_KEYS', '') or ''
    claves: dict[str, str] = {}
    for entrada in crudo.split(','):
        nombre, separador, clave = entrada.strip().partition(':')
        nombre, clave = nombre.strip().lower(), clave.strip()
        if not separador or not nombre:
            continue
        if len(clave) < LONGITUD_MINIMA_CLAVE:
            logger.warning('Clave de integración descartada por corta (sistema=%s).', nombre)
            continue
        claves[nombre] = clave
    return claves


class ApiKeyIntegracionAuthentication(BaseAuthentication):
    def authenticate(self, request):
        claves = claves_configuradas()
        if not claves:
            raise IntegracionNoConfigurada()
        presentada = (request.META.get('HTTP_X_API_KEY') or '').encode('utf-8')
        if not presentada:
            raise AuthenticationFailed('Credenciales de integración no válidas.')
        sistema = None
        for nombre, clave in claves.items():  # recorre todas: el tiempo no revela cuál coincidió
            if hmac.compare_digest(presentada, clave.encode('utf-8')):
                sistema = nombre
        if sistema is None:
            raise AuthenticationFailed('Credenciales de integración no válidas.')
        return SistemaIntegrado(sistema), sistema

    def authenticate_header(self, request):
        return CABECERA_API_KEY


class IntegracionCarnetThrottle(SimpleRateThrottle):
    """Límite por sistema (no por IP): la tasa sale de `DEFAULT_THROTTLE_RATES['integracion_carnet']`."""
    scope = 'integracion_carnet'

    def get_cache_key(self, request, view):
        sistema = request.auth
        if not sistema:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': sistema}
