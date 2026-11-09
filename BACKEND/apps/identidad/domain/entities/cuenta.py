"""
Entidad `Cuenta` del dominio de identidad (gestión de usuarios).

Representa una cuenta de acceso identificada por la cédula del empleado
(mismo agregado que ya usa el login/bloqueo del módulo). Pura e inmutable
(reglas B1, B5): el repositorio ORM la materializa desde `CuentaModel` y los
casos de uso solo la leen/transforman con estos métodos.

D3: la cuenta ya no expone `departamento_id`. El departamento es un dato
legado de `USER_cuenta` que no participa de la autorización; esta depende solo
del rol y de los permisos efectivos (motor IAM).
"""
from dataclasses import dataclass, replace
from datetime import datetime


@dataclass(frozen=True)
class Cuenta:
    """Cuenta de acceso de un empleado: identidad, rol y estado."""

    id: int | None
    cedula: str
    nombres: str = ''
    apellidos: str = ''
    correo: str | None = None
    correo_alternativo: str | None = None
    telefono: str | None = None
    rol_id: int | None = None
    rol_nombre: str | None = None
    rol_nombre_visible: str | None = None
    is_active: bool = True
    ultimo_acceso: datetime | None = None
    condicion: str | None = None
    password_inicial_pendiente: bool = False
    # Versión de permisos de la cuenta: invalida la caché de `/auth/me` en el acto.
    permisos_version: int = 1
    # Calculado en la fila ya cargada (`check_password` en memoria, sin consulta extra).
    debe_cambiar_password: bool | None = None

    def con_datos(self, *, rol_id: int | None = ...) -> 'Cuenta':
        """Nueva `Cuenta` con el rol reasignado (edición parcial)."""
        cambios = {}
        if rol_id is not ...:
            cambios['rol_id'] = rol_id
        return replace(self, **cambios)

    def activar(self) -> 'Cuenta':
        return replace(self, is_active=True)

    def desactivar(self) -> 'Cuenta':
        return replace(self, is_active=False)

    def con_estado(self, is_active: bool) -> 'Cuenta':
        return replace(self, is_active=is_active)
