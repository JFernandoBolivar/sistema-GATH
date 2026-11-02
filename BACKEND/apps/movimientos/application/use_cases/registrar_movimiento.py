"""
Caso de uso para registrar una entrada en el historial de movimientos de
cargo (Fase 2.5 del plan de reparación). Invocado por
`apps.movimientos.infrastructure.receivers` en respuesta al evento
`apps.cargos.domain.events.cargo_movimiento_ejecutado` — nunca llamado
directamente desde `apps.cargos` (Regla B16).
"""
from apps.movimientos.application.dtos.movimientos_dtos import MovimientoCargoDTO
from apps.movimientos.application.use_cases.listar_historial import _a_dto
from apps.movimientos.domain.ports.repo_movimientos import RepoMovimientos


def registrar_movimiento(
    repo: RepoMovimientos,
    cargo_id: int,
    cedula: str,
    tipo_movimiento: str,
    motivo_id: int | None,
    usuario_id: int,
) -> MovimientoCargoDTO:
    entidad = repo.registrar_movimiento(
        cargo_id=cargo_id,
        cedula=cedula,
        tipo_movimiento=tipo_movimiento,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )
    return _a_dto(entidad)
