"""
Adaptador de infraestructura para la validación de fortaleza de contraseñas.

Vive en `infrastructure/` (no en `application/`) porque depende de
`django.contrib.auth.password_validation`: la piel de la regla B4 es que la
capa de aplicación no importa el framework. El caso de uso `cambiar_password`
lo recibe por inyección (por defecto en la vista se le pasa éste; en los tests
de unidad se sustituye por un stub).
"""
from typing import Callable

from django.contrib.auth.password_validation import validate_password

from core.domain.exceptions import ValidationError


def validar_fortaleza_django(password: str) -> None:
    """Valida la fortaleza con el validador de Django y traduce a dominio."""
    try:
        validate_password(password)
    except Exception as exc:  # DjangoValidationError u otros validadores
        from django.core.exceptions import ValidationError as DjangoValidationError

        if isinstance(exc, DjangoValidationError):
            raise ValidationError('; '.join(exc.messages)) from exc
        raise ValidationError(str(exc)) from exc


validar_fortaleza: Callable[[str], None] = validar_fortaleza_django
