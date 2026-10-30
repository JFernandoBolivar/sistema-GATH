"""
Bindings de permisos del módulo identidad (B3.1).

Único lugar donde el módulo decide qué código `[modulo].[accion]` exige cada
operación propia (Contrato C-3): las vistas importan de aquí, nunca escriben
el literal suelto.
"""
from core.presentation.permissions import HasPermission

PERMISO_LISTAR_PERMISOS = HasPermission('identidad.listar_permisos')
PERMISO_CONSULTAR_PERMISOS_CUENTA = HasPermission(
    'identidad.consultar_permisos'
)

# Gestión de usuarios (catálogo real sembrado por `seed_permisos`, ver
# PERMISOS.md). CRIT-05: el alta y la edición exigen permiso, no `AllowAny`.
PERMISO_VER_USUARIOS = HasPermission('identidad.ver_usuarios')
PERMISO_CREAR_USUARIOS = HasPermission('identidad.crear_usuarios')
PERMISO_EDITAR_USUARIOS = HasPermission('identidad.editar_usuarios')
PERMISO_DESACTIVAR_USUARIOS = HasPermission('identidad.desactivar_usuarios')
# Ciclo de vida de las cuentas (D8): RRHH repone la contraseña inicial / elige el correo de acceso.
PERMISO_RESTABLECER_ACCESO = HasPermission('identidad.restablecer_acceso')
PERMISO_CAMBIAR_CORREO_ACCESO = HasPermission('identidad.cambiar_correo_acceso')

# CRUD del catálogo de roles (CRIT-12: reemplaza el puente `EsAdministrador`).
PERMISO_VER_ROLES = HasPermission('identidad.ver_roles')
PERMISO_CREAR_ROLES = HasPermission('identidad.crear_roles')
PERMISO_EDITAR_ROLES = HasPermission('identidad.editar_roles')
PERMISO_ELIMINAR_ROLES = HasPermission('identidad.eliminar_roles')
