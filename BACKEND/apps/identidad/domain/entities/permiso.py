"""
Entidad `Permiso` del dominio de identidad (B3.1).

Capacidad atómica del sistema, identificada por un código `[modulo].[accion]`
(Contrato C-3). Pura: sin Django ni ORM (regla B1); inmutable (regla B5).
"""
from dataclasses import dataclass

from apps.identidad.domain.value_objects.codigo_permiso import CodigoPermiso


@dataclass(frozen=True)
class Permiso:
    """Un permiso concedible a roles o cuentas: `modulo.accion` + nombre legible."""

    codigo: CodigoPermiso
    nombre: str

    def __post_init__(self):
        if not self.nombre or not self.nombre.strip():
            from core.domain.exceptions import ValidationError

            raise ValidationError('El nombre del permiso es obligatorio.')

    def __str__(self) -> str:
        return f'{self.codigo.valor} — {self.nombre}'
