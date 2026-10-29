"""
Re-exportador de modelos ORM del módulo identidad (regla B26).

Django descubre modelos por convención en `<app>.models`; los reales viven en
`infrastructure/models/` para respetar la arquitectura Onion.
"""
from apps.identidad.infrastructure.legado.cuenta_models import (
    CuentaEspejo,
    RolEspejo,
)
from apps.identidad.infrastructure.models.intento_fallido_model import (
    IntentoFallidoModel,
)
from apps.identidad.infrastructure.models.permiso_model import (
    PermisoModel,
    RolPermisoModel,
)
from apps.identidad.infrastructure.models.usuario_permiso_model import (
    UsuarioPermisoModel,
)
from apps.identidad.infrastructure.models.permisos_version_model import (
    PermisosVersionModel,
)
from apps.identidad.infrastructure.models.cuenta_models import (
    CuentaModel,
    RolModel,
    DepartamentoModel,
)

__all__ = [
    'PermisoModel',
    'RolPermisoModel',
    'IntentoFallidoModel',
    'UsuarioPermisoModel',
    'PermisosVersionModel',
    'CuentaEspejo',
    'RolEspejo',
    'CuentaModel',
    'RolModel',
    'DepartamentoModel',
]
