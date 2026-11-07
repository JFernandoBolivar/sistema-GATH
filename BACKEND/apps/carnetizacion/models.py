"""Re-exportador de modelos ORM del módulo carnetizacion (Regla B26)."""
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    CarnetTemplateModel,
    MotivosEmisionModel,
    PlantillaCarnetModel,
    TipoCredencialModel,
)

__all__ = [
    'MotivosEmisionModel',
    'TipoCredencialModel',
    'PlantillaCarnetModel',
    'CarnetEmitidoModel',
    'CarnetTemplateModel',
]
