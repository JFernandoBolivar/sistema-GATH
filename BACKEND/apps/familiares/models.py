"""
Re-exportador de modelos ORM del módulo familiares (Regla B26).
"""
from apps.familiares.infrastructure.models.familiar_models import (
    EmployeefamilyModel,
    FamilyDocumentModel,
)

__all__ = [
    'EmployeefamilyModel',
    'FamilyDocumentModel',
]
