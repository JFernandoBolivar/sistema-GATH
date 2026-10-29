"""
Vista mínima de una cuenta para el flujo de recuperación de contraseña.

Pura e inmutable (B1, B5): lleva solo lo que el flujo necesita (identificación,
correo de destino y el hash actual, que ancla el token de un solo uso).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CuentaRecuperacion:
    id: int
    cedula: str
    correo: str | None
    nombre_completo: str
    password_hash: str
    activa: bool
