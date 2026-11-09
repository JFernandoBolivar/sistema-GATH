"""
DTOs de gestión de usuarios (registro, edición, estado, contraseña propia).

Dataclasses inmutables de entrada de los casos de uso (regla B5): transportan
primitivas de la petición HTTP, nunca instancias del ORM.

D3: `departamento_id` quedó fuera del contrato de identidad. La columna legada
sigue existiendo en `USER_cuenta` (`managed=False`), pero ya no se lee ni se
escribe desde este módulo: la autorización depende solo del rol y los permisos.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class RegistrarCuentaDTO:
    """Entrada de `registrar_usuario` (alta de cuenta, CRIT-05)."""

    cedula: str
    password: str
    rol_id: int | None = None


@dataclass(frozen=True)
class ActualizarCuentaDTO:
    """Entrada de `editar_usuario`. `...` en un campo significa "no tocar".

    M2: la contraseña no forma parte de esta edición; solo «Restablecer acceso»
    y el cambio de contraseña propio la modifican.
    """

    id: int
    rol_id: int | None = None
    tocar_rol: bool = False


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
