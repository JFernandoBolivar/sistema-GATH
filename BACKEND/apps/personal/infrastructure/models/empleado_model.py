"""Compatibilidad: reexporta `EmployeeModel` desde `personal_models`.

Algunos módulos (`configuracion`) empezaron a importar
`apps.personal.infrastructure.models.empleado_model`; hasta que se complete
esa reorganización, este archivo mantiene el mismo objeto sin duplicar el
modelo ni crear una segunda tabla.
"""
from apps.personal.infrastructure.models.personal_models import EmployeeModel

__all__ = ['EmployeeModel']
