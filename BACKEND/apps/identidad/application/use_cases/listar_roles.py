"""
Caso de uso `listar_roles` (catálogo de roles).

Puro: recibe el puerto por inyección (B4/B21).
"""
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.domain.ports.repo_roles import RepoRoles


def listar_roles(repo: RepoRoles) -> list[Rol]:
    """Catálogo completo de roles."""
    return repo.listar()
