"""
Adaptador hacia el kernel: registro del resolutor de permisos (B3.2).

`apps.identidad` es la dueña del dominio de permisos, así que provee la
implementación del puerto `core.domain.ports.ResolutorPermisos` que consume
`core/presentation/permissions.py`. El registro ocurre en
`IdentidadConfig.ready()` — el kernel jamás importa de apps (B16); es la app
la que empuja su implementación al `core.infrastructure.providers`.
"""
from core.infrastructure.providers import (
    registrar_resolutor_condicion,
    registrar_resolutor_permisos,
    registrar_resolutor_rol_actor,
)

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.resolver_permisos import (
    resolver_permisos as resolver_permisos_use_case,
    tiene_permiso,
)
from apps.identidad.infrastructure.cache.permisos_cache import (
    resolver_permisos as resolver_permisos_cache,
)
from apps.identidad.application.use_cases.obtener_condicion_trabajador import (
    obtener_condicion_trabajador,
)
from apps.identidad.infrastructure.providers.resolutor_rol_actor import ResolutorRolActorORM
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_permisos_orm import (
    RepoPermisosORM,
)


class ResolutorIdentidad:
    """Implementa `ResolutorPermisos` con la matriz de identidad (B3.2)."""

    def __init__(self, repo=None):
        self._repo = repo or RepoPermisosORM()

    def tiene_permiso(
        self,
        *,
        actor_id: int | None,
        rol_id: int | None,
        codigo: str,
        cedula: str | None = None,
        version: int = 1,
    ) -> bool:
        if not cedula:
            actor = ActorSesionDTO(cuenta_id=actor_id, rol_id=rol_id, cedula=cedula)
            return tiene_permiso(self._repo, actor, codigo)
        return codigo in resolver_permisos_cache(
            self._repo, cedula, rol_id, version
        )

    def permisos_de_actor(
        self,
        *,
        actor_id: int | None,
        rol_id: int | None,
        cedula: str | None = None,
        version: int = 1,
    ) -> frozenset[str]:
        if not cedula:
            actor = ActorSesionDTO(cuenta_id=actor_id, rol_id=rol_id, cedula=cedula)
            return resolver_permisos_use_case(self._repo, actor)
        return resolver_permisos_cache(self._repo, cedula, rol_id, version)


class ResolutorCondicionIdentidad:
    """Implementa `ResolutorCondicionTrabajador` con los datos de personal (ACTIVO/PASIVO)."""

    def __init__(self, repo=None):
        self._repo = repo or RepoCondicionTrabajadorORM()

    def condicion_de(self, cedula: str) -> str:
        return obtener_condicion_trabajador(self._repo, cedula).value


def registrar_resolutor_en_kernel() -> None:
    """Registra la implementación del módulo en el provider del kernel."""
    registrar_resolutor_permisos(ResolutorIdentidad())
    registrar_resolutor_condicion(ResolutorCondicionIdentidad())
    registrar_resolutor_rol_actor(ResolutorRolActorORM())
