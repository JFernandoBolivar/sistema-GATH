"""
Adaptador hacia el kernel: registro del resolutor de permisos (B3.2).

`apps.identidad` es la dueña del dominio de permisos, así que provee la
implementación del puerto `core.domain.ports.ResolutorPermisos` que consume
`core/presentation/permissions.py`. El registro ocurre en
`IdentidadConfig.ready()` — el kernel jamás importa de apps (B16); es la app
la que empuja su implementación al `core.infrastructure.providers`.
"""
from core.domain.ports import ResolutorPermisos
from core.infrastructure.providers import registrar_resolutor_permisos

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.resolver_permisos import (
    resolver_permisos,
    tiene_permiso,
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
    ) -> bool:
        actor = ActorSesionDTO(cuenta_id=actor_id, rol_id=rol_id, cedula=cedula)
        return tiene_permiso(self._repo, actor, codigo)

    def permisos_de_actor(
        self,
        *,
        actor_id: int | None,
        rol_id: int | None,
        cedula: str | None = None,
    ) -> frozenset[str]:
        actor = ActorSesionDTO(cuenta_id=actor_id, rol_id=rol_id, cedula=cedula)
        return resolver_permisos(self._repo, actor)


def registrar_resolutor_en_kernel() -> None:
    """Registra la implementación del módulo en el provider del kernel."""
    registrar_resolutor_permisos(ResolutorIdentidad())
