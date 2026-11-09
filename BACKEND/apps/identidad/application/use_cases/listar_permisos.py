"""
Caso de uso `listar_permisos` (B3.1).

Catálogo completo de permisos del sistema para la capa de entrega.
"""
from apps.identidad.domain.entities.permiso import Permiso
from apps.identidad.domain.ports.repo_permisos import RepoPermisos


def listar_permisos(repo: RepoPermisos) -> list[Permiso]:
    """Devuelve el catálogo completo; el orden lo define el repositorio."""
    return repo.listar()
