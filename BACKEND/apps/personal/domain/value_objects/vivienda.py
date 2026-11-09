"""Value Objects y utilidades de normalización para vivienda."""

from core.domain.validacion_personas import (
    MAX_LONGITUD_CIUDAD_REGION,
    normalizar_ciudad_region,
)

__all__ = ['MAX_LONGITUD_CIUDAD_REGION', 'normalizar_ciudad_region']
