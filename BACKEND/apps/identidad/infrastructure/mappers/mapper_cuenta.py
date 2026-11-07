"""
Mapper ORM → entidad `Cuenta` del módulo identidad (gestión de usuarios).

Función pura `cuenta_a_entidad()`: las filas del ORM nunca cruzan hacia las
capas internas (regla B6). Requiere que el `CuentaModel` recibido venga con
`select_related('cedula', 'rol')` para no disparar una consulta N+1 por fila.
"""
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel


def cuenta_a_entidad(fila: CuentaModel) -> Cuenta:
    """Convierte una fila `USER_cuenta` (+ empleado y rol precargados) en `Cuenta`."""
    empleado = getattr(fila, 'cedula', None)
    rol = getattr(fila, 'rol', None)
    return Cuenta(
        id=fila.pk,
        cedula=str(fila.cedula_id) if fila.cedula_id is not None else '',
        nombres=getattr(empleado, 'nombres', '') or '',
        apellidos=getattr(empleado, 'apellidos', '') or '',
        correo=getattr(empleado, 'correo', None),
        telefono=getattr(empleado, 'telefono_movil', None),
        rol_id=fila.rol_id,
        rol_nombre=getattr(rol, 'nombre_rol', None),
        rol_nombre_visible=(getattr(rol, 'nombre_visible', None) or getattr(rol, 'nombre_rol', None)),
        is_active=fila.is_active,
        ultimo_acceso=fila.last_login,
        condicion=getattr(fila, 'condicion_calculada', None),
        permisos_version=getattr(fila, 'permisos_version', None) or 1,
        debe_cambiar_password=getattr(fila, 'debe_cambiar_password', None),
    )
