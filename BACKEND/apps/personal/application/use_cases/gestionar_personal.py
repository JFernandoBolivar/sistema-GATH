"""
Casos de uso para registrar y actualizar datos de empleados.
"""
from apps.personal.application.dtos.personal_dtos import EmpleadoDTO
from apps.personal.application.use_cases.listar_personal import _empleado_a_dto
from apps.personal.domain.ports.repo_personal import RepoPersonal


def registrar_empleado(repo: RepoPersonal, datos: dict) -> EmpleadoDTO:
    entidad = repo.crear_empleado(datos)
    return _empleado_a_dto(entidad)


def actualizar_empleado(
    repo: RepoPersonal, cedula: str, datos: dict
) -> EmpleadoDTO:
    entidad = repo.actualizar_empleado(cedula=cedula, datos=datos)
    return _empleado_a_dto(entidad)


def guardar_foto(repo: RepoPersonal, cedula: str, clave: str) -> None:
    repo.guardar_foto(cedula=cedula, clave=clave)
