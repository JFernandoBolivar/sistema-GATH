"""Throttles de archivos y exportaciones (E2).

Se aplican sobre el tráfico global, pero solo cuentan peticiones que suben un
archivo o descargan un reporte. Las tasas salen de settings (sin hardcodeo).
"""
from rest_framework.throttling import SimpleRateThrottle

RUTAS_SUBIDA = ('/soportes/', '/evidencia', '/foto', '/archivo', '/carga-masiva')
RUTAS_EXPORTACION = ('/pdf/', '/excel/', '/export', '/descargar')


class _ThrottlePorRuta(SimpleRateThrottle):
    rutas: tuple[str, ...] = ()

    def get_cache_key(self, request, view):
        ruta = request.path.lower()
        if not any(fragmento in ruta for fragmento in self.rutas):
            return None
        identidad = getattr(getattr(request, 'user', None), 'pk', None)
        return self.cache_format % {
            'scope': self.scope,
            'ident': identidad or self.get_ident(request),
        }


class UploadRateThrottle(_ThrottlePorRuta):
    scope = 'upload'
    rutas = RUTAS_SUBIDA


class ExportRateThrottle(_ThrottlePorRuta):
    scope = 'export'
    rutas = RUTAS_EXPORTACION
