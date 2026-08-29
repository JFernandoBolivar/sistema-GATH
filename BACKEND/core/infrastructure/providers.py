"""
Registro de proveedores del kernel (B3.2).

El kernel no puede importar de `apps/` (regla B16), así que las apps registran
aquí sus implementaciones de los puertos transversales durante
`AppConfig.ready()`. Mientras no haya registro, el comportamiento es de fallo
cerrado (S2): se deniega.

`reiniciar_proveedores()` existe para aislar tests unitarios; no usar en código
de negocio.
"""
from core.domain.ports import ResolutorPermisos

_resolutor_permisos: ResolutorPermisos | None = None


def registrar_resolutor_permisos(implementacion: ResolutorPermisos) -> None:
    """Registra (o reemplaza) la implementación activa del resolutor."""
    global _resolutor_permisos
    _resolutor_permisos = implementacion


def obtener_resolutor_permisos() -> ResolutorPermisos | None:
    """Devuelve la implementación registrada, o `None` si nadie registró una."""
    return _resolutor_permisos


def reiniciar_proveedores() -> None:
    """Limpia los registros. Solo para tests."""
    global _resolutor_permisos
    _resolutor_permisos = None
