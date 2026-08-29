"""
Re-exportador de modelos ORM del módulo organización (Regla B26).
"""
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
    OrganismoAdscritoModel,
)

__all__ = [
    'DependenciaModel',
    'DireccionGeneralModel',
    'DireccionLineaModel',
    'CoordinacionModel',
    'OrganismoAdscritoModel',
]
