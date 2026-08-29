"""
Re-exportador de modelos ORM del módulo carnetización (Regla B26).
"""
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    CarnetTemplateModel,
    MotivosEmisionModel,
)

__all__ = [
    'MotivosEmisionModel',
    'CarnetEmitidoModel',
    'CarnetTemplateModel',
]
