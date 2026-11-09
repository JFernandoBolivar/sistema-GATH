"""
Re-exportador de modelos ORM del módulo cargos (Regla B26).
"""
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.cargos.infrastructure.models.prestamo_models import PrestamoCargoModel

__all__ = [
    'DenominacionCargoModel',
    'DenominacionCargoEspecificoModel',
    'AsigTrabajoModel',
    'PrestamoCargoModel',
]
