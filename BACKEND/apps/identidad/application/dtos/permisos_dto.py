"""
DTOs del dominio de permisos (B3.1/B3.2).

Dataclasses inmutables de entrada/salida de los casos de uso (regla B5):
transportan primitivas de sesión, nunca instancias del ORM.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class ActorSesionDTO:
    """
    Primitivas del actor autenticado tal como llegan desde la sesión
    (`request.user.pk`, `request.user.rol_id`, `request.user.cedula`), sin tipos legados.
    """

    cuenta_id: int | None = None
    rol_id: int | None = None
    cedula: str | None = None


@dataclass(frozen=True)
class PermisosEfectivosDTO:
    """Salida de `obtener_permisos_de_cuenta`: códigos efectivos de una cuenta."""

    cedula: str
    rol_id: int | None
    codigos: frozenset[str]

    def tiene(self, codigo: str) -> bool:
        """¿El código está entre los permisos efectivos?"""
        return codigo in self.codigos
