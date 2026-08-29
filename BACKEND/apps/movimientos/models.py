"""
Re-exportador de modelos ORM del módulo movimientos (Regla B26).
"""
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel

__all__ = [
    'EmployeeMovementHistoryModel',
]
