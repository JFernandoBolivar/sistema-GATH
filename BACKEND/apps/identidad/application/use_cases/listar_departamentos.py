"""
Caso de uso `listar_departamentos` (catálogo administrativo).

Puro: recibe el puerto por inyección (B4/B21).
"""
from apps.identidad.domain.entities.departamento import Departamento
from apps.identidad.domain.ports.repo_departamentos import RepoDepartamentos


def listar_departamentos(repo: RepoDepartamentos) -> list[Departamento]:
    """Catálogo completo de departamentos."""
    return repo.listar()
