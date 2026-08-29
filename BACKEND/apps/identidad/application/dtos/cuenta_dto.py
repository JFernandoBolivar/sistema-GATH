"""
DTOs de gestión de usuarios (registro, edición, estado, contraseña propia).

Dataclasses inmutables de entrada de los casos de uso (regla B5): transportan
primitivas de la petición HTTP, nunca instancias del ORM.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class RegistrarCuentaDTO:
    """Entrada de `registrar_usuario` (alta de cuenta, CRIT-05)."""

    cedula: str
    password: str
    departamento_id: int | None = None
    rol_id: int | None = None


@dataclass(frozen=True)
class ActualizarCuentaDTO:
    """Entrada de `editar_usuario`. `...` en un campo significa "no tocar"."""

    id: int
    departamento_id: int | None = None
    rol_id: int | None = None
    tocar_departamento: bool = False
    tocar_rol: bool = False
    password: str | None = None


@dataclass(frozen=True)
class CambiarEstadoCuentaDTO:
    """Entrada de `cambiar_estado_usuario`. `is_active=None` alterna el estado actual."""

    id: int
    is_active: bool | None = None


@dataclass(frozen=True)
class CambiarPasswordDTO:
    """Entrada de `cambiar_password` (propio, CRIT-04): exige la contraseña actual."""

    actor_id: int
    password_actual: str
    password_nuevo: str
