"""
Puerto del repositorio de departamentos (catálogo administrativo, D-09/B21).

Protocolo puro (regla B1); la implementación ORM vive en
`infrastructure/repositories/repo_departamentos_orm.py`.
"""
from typing import Protocol

from apps.identidad.domain.entities.departamento import Departamento


class RepoDepartamentos(Protocol):
    """Contrato de lectura del catálogo de departamentos."""

    def listar(self) -> list[Departamento]:
        """Catálogo completo de departamentos."""
        ...
