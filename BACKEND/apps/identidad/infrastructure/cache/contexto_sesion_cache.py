"""Caché del contexto mínimo de autenticación (L-NEW2).

Solo se guarda lo que necesita `CookieJWTAuthentication.get_user`: id, cédula,
rol, estado y versión de permisos. La clave incluye la versión del token, de
modo que un token viejo no puede reutilizar un contexto vigente. La
invalidación borra las versiones conocidas de esa cuenta; si Redis falla, la
autenticación cae a la consulta de la base (nunca a «dejar pasar»).
"""
from dataclasses import dataclass

from django.core.cache import cache

TTL_CONTEXTO_SESION = 60
_PREFIJO = 'iam:contexto'


@dataclass(frozen=True)
class ContextoSesion:
    """Vista mínima de la cuenta para autenticar y autorizar."""

    id: int
    cedula_id: str
    rol_id: int | None
    is_active: bool
    permisos_version: int

    @property
    def pk(self) -> int:
        return self.id

    @property
    def is_authenticated(self) -> bool:
        return True

    def __str__(self) -> str:
        return self.cedula_id


def clave_contexto(cuenta_id: int, version: int) -> str:
    return f'{_PREFIJO}:{cuenta_id}:v{version}'


def leer_contexto(cuenta_id: int, version: int) -> ContextoSesion | None:
    try:
        valor = cache.get(clave_contexto(cuenta_id, version))
    except Exception:  # noqa: BLE001 - Redis caído no debe tumbar la sesión
        return None
    if isinstance(valor, ContextoSesion):
        return valor
    if isinstance(valor, dict):
        return ContextoSesion(**valor)
    return None


def guardar_contexto(contexto: ContextoSesion) -> None:
    try:
        cache.set(
            clave_contexto(contexto.id, contexto.permisos_version),
            contexto,
            TTL_CONTEXTO_SESION,
        )
    except Exception:  # noqa: BLE001
        pass


def invalidar_contexto(cuenta_id: int, version_actual: int | None = None) -> None:
    """Borra las claves de versiones anteriores y la vigente.

    Las versiones son enteros pequeños; borrar hasta la versión actual + 2
    cubre el token que acaba de quedar obsoleto sin usar `delete_pattern`
    (no disponible en el backend de caché configurado).
    """
    if version_actual is None:
        version_actual = 1
    claves = [
        clave_contexto(cuenta_id, version)
        for version in range(1, max(2, int(version_actual) + 3))
    ]
    try:
        cache.delete_many(claves)
    except Exception:  # noqa: BLE001
        pass
