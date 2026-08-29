"""
Re-exportador de modelos ORM del módulo pasivos (Regla B26).
"""
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel

__all__ = [
    'EmployeeEgresadoModel',
]
