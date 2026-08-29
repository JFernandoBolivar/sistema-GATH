"""
Jerarquía de excepciones de dominio (B2.1).

Puras: sin dependencias de Django ni DRF (regla B1). La traducción a
respuestas HTTP ocurre exclusivamente en `core/presentation/exception_handler.py`
(regla B10) — nunca en las vistas ni aquí.
"""


class DomainError(Exception):
    """Raíz de toda excepción de negocio en GATH."""


class NotFoundError(DomainError):
    """El recurso solicitado no existe."""


class ValidationError(DomainError):
    """Un Value Object o una regla de negocio detecta un dato inválido."""


class PermissionDeniedError(DomainError):
    """El actor no tiene el permiso o la propiedad requerida sobre el recurso."""


class ConflictError(DomainError):
    """La operación entra en conflicto con el estado actual del recurso (409)."""
