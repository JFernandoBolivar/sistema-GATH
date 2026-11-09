"""
Casos de uso para registro, edición y eliminación de familiares.
"""
from apps.familiares.application.dtos.familiares_dtos import FamiliarDTO
from apps.familiares.application.use_cases.listar_familiares import _familiar_a_dto
from apps.familiares.domain.ports.repo_familiares import RepoFamiliares


def registrar_familiar(
    repo: RepoFamiliares, familiar_datos: dict
) -> FamiliarDTO:
    entidad = repo.crear_familiar(familiar_datos)
    return _familiar_a_dto(entidad)


def actualizar_familiar(
    repo: RepoFamiliares, familiar_id: int, datos: dict
) -> FamiliarDTO:
    entidad = repo.actualizar_familiar(familiar_id=familiar_id, datos=datos)
    return _familiar_a_dto(entidad)


def eliminar_familiar(repo: RepoFamiliares, familiar_id: int) -> None:
    repo.eliminar_familiar(familiar_id)
