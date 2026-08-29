"""
Entidad `Cuenta` del dominio de identidad (gestión de usuarios).

Representa una cuenta de acceso identificada por la cédula del empleado
(mismo agregado que ya usa el login/bloqueo del módulo). Pura e inmutable
(reglas B1, B5): el repositorio ORM la materializa desde `CuentaModel` y los
casos de uso solo la leen/transforman con estos métodos.
"""
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Cuenta:
    """Cuenta de acceso de un empleado: identidad, rol, departamento y estado."""

    id: int | None
    cedula: str
    nombres: str = ''
    apellidos: str = ''
    correo: str | None = None
    telefono: str | None = None
    departamento_id: int | None = None
    rol_id: int | None = None
    is_active: bool = True

    def con_datos(
        self,
        *,
        departamento_id: int | None = ...,
        rol_id: int | None = ...,
    ) -> 'Cuenta':
        """Nueva `Cuenta` con departamento y/o rol reasignados (edición parcial)."""
        cambios = {}
        if departamento_id is not ...:
            cambios['departamento_id'] = departamento_id
        if rol_id is not ...:
            cambios['rol_id'] = rol_id
        return replace(self, **cambios)

    def activar(self) -> 'Cuenta':
        return replace(self, is_active=True)

    def desactivar(self) -> 'Cuenta':
        return replace(self, is_active=False)

    def con_estado(self, is_active: bool) -> 'Cuenta':
        return replace(self, is_active=is_active)
