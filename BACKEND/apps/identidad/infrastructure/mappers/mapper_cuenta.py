"""
Mapper ORM ↔ entidad `Cuenta` del módulo identidad (gestión de usuarios).

Función pura `a_entidad()`: las filas del ORM nunca cruzan hacia las capas
internas (regla B6). Requiere que el `CuentaModel` recibido venga con
`select_related('cedula')` para no disparar una consulta N+1 por fila.
"""
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel


def cuenta_a_entidad(fila: CuentaModel) -> Cuenta:
    """Convierte una fila `USER_cuenta` (+ empleado precargado) en `Cuenta`."""
    empleado = getattr(fila, 'cedula', None)
    return Cuenta(
        id=fila.pk,
        cedula=str(fila.cedula_id) if fila.cedula_id is not None else '',
        nombres=getattr(empleado, 'nombres', '') or '',
        apellidos=getattr(empleado, 'apellidos', '') or '',
        correo=getattr(empleado, 'correo', None),
        telefono=getattr(empleado, 'telefono_movil', None),
        departamento_id=fila.departamento_id,
        rol_id=fila.rol_id,
        is_active=fila.is_active,
    )
