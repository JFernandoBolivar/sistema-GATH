"""
Caso de uso para consultar el expediente de un empleado por cédula.
"""
from core.domain.exceptions import NotFoundError
from apps.personal.application.dtos.personal_dtos import EmpleadoDTO
from apps.personal.application.use_cases.listar_personal import _empleado_a_dto
from apps.personal.domain.ports.repo_personal import RepoPersonal


def obtener_personal_por_cedula(repo: RepoPersonal, cedula: str) -> EmpleadoDTO:
    entidad = repo.obtener_por_cedula(cedula)
    if not entidad:
        raise NotFoundError(f"Empleado con cédula {cedula} no encontrado")
    return _empleado_a_dto(entidad)
