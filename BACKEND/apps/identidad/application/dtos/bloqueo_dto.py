"""
DTOs del dominio de bloqueo de cuentas (B3.12).

Dataclasses inmutables de entrada de los casos de uso (regla B5): transportan
primitivas de la petición HTTP, nunca instancias del ORM ni tipos legados.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class IntentoFallidoDTO:
    """Entrada de `registrar_intento_fallido`: cuenta e IP de origen."""

    cedula: str
    ip: str | None = None
