"""
Caso de uso para asignar un cargo vacante a un empleado.
"""
from apps.cargos.application.dtos.cargos_dtos import CargoAsignacionDTO
from apps.cargos.application.use_cases.listar_cargos import _a_dto
from apps.cargos.domain.ports.repo_cargos import RepoCargos


def asignar_cargo(
    repo: RepoCargos,
    cargo_id: int,
    cedula: str,
    motivo_id: int | None = None,
    usuario_id: int | None = None,
) -> CargoAsignacionDTO:
    entidad = repo.asignar_cargo_a_empleado(
        cargo_id=cargo_id, cedula=cedula, motivo_id=motivo_id, usuario_id=usuario_id,
    )
    return _a_dto(entidad)


def desasignar_cargo(
    repo: RepoCargos,
    cargo_id: int,
    motivo_id: int | None = None,
    usuario_id: int | None = None,
) -> CargoAsignacionDTO:
    entidad = repo.desasignar_cargo(cargo_id=cargo_id, motivo_id=motivo_id, usuario_id=usuario_id)
    return _a_dto(entidad)
