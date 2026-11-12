"""
Registro de proveedores del kernel (B3.2).

El kernel no puede importar de `apps/` (regla B16), así que las apps registran
aquí sus implementaciones de los puertos transversales durante
`AppConfig.ready()`. Mientras no haya registro, el comportamiento es de fallo
cerrado (S2): se deniega.

`reiniciar_proveedores()` existe para aislar tests unitarios; no usar en código
de negocio.
"""
from core.domain.ports import (
    LectorConfiguracion,
    Notificador,
    ResolutorCondicionTrabajador,
    ResolutorPermisos,
    ResolutorRolActor,
)

_resolutor_permisos: ResolutorPermisos | None = None
_resolutor_condicion: ResolutorCondicionTrabajador | None = None
_notificador: Notificador | None = None
_lector_configuracion: LectorConfiguracion | None = None
_resolutor_rol_actor: ResolutorRolActor | None = None


def registrar_resolutor_permisos(implementacion: ResolutorPermisos) -> None:
    """Registra (o reemplaza) la implementación activa del resolutor."""
    global _resolutor_permisos
    _resolutor_permisos = implementacion


def obtener_resolutor_permisos() -> ResolutorPermisos | None:
    """Devuelve la implementación registrada, o `None` si nadie registró una."""
    return _resolutor_permisos


def registrar_resolutor_condicion(implementacion: ResolutorCondicionTrabajador) -> None:
    """Registra (o reemplaza) el resolutor de la condición ACTIVO/PASIVO del trabajador."""
    global _resolutor_condicion
    _resolutor_condicion = implementacion


def obtener_resolutor_condicion() -> ResolutorCondicionTrabajador | None:
    return _resolutor_condicion


def registrar_notificador(implementacion: Notificador) -> None:
    """Registra la implementación del puerto `Notificador` (la aporta `apps.notificaciones`)."""
    global _notificador
    _notificador = implementacion


def obtener_notificador() -> Notificador | None:
    return _notificador


def registrar_lector_configuracion(implementacion: LectorConfiguracion) -> None:
    """Registra el lector de parámetros del sistema (lo aporta `apps.configuracion`)."""
    global _lector_configuracion
    _lector_configuracion = implementacion


def obtener_lector_configuracion() -> LectorConfiguracion | None:
    return _lector_configuracion


def registrar_resolutor_rol_actor(implementacion: ResolutorRolActor) -> None:
    """Registra el lector del rol visible de una cuenta (lo aporta `apps.identidad`)."""
    global _resolutor_rol_actor
    _resolutor_rol_actor = implementacion


def obtener_resolutor_rol_actor() -> ResolutorRolActor | None:
    """Devuelve el lector registrado, o `None` (la auditoría registra sin rol)."""
    return _resolutor_rol_actor


def reiniciar_proveedores() -> None:
    """Limpia los registros. Solo para tests."""
    global _resolutor_permisos, _resolutor_condicion, _notificador, _lector_configuracion
    global _resolutor_rol_actor
    _resolutor_permisos = None
    _resolutor_condicion = None
    _notificador = None
    _lector_configuracion = None
    _resolutor_rol_actor = None
