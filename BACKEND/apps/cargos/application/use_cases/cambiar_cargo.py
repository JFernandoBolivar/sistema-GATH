"""
Caso de uso para el traslado de un empleado a un cargo vacante (Fase 2.5 del
plan de reparación). Réplica funcional de
`RAC/serializers/historial_personal_serializers.py::MovimintoCargoSerializer`.
"""
from apps.cargos.application.dtos.cargos_dtos import CargoAsignacionDTO
from apps.cargos.application.use_cases.listar_cargos import _a_dto
from apps.cargos.domain.ports.repo_cargos import RepoCargos


def cambiar_cargo(
    repo: RepoCargos,
    cargo_actual_id: int,
    cargo_nuevo_id: int,
    motivo_id: int,
    usuario_id: int,
) -> CargoAsignacionDTO:
    entidad = repo.cambiar_cargo(
        cargo_actual_id=cargo_actual_id,
        cargo_nuevo_id=cargo_nuevo_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )
    return _a_dto(entidad)
