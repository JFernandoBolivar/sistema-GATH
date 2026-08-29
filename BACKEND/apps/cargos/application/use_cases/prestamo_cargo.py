"""
Casos de uso del subsistema de préstamo de cargo / encargaduría (Fase 2.5
del plan de reparación). Réplica funcional de
`RAC/services/prestamo_cargo_services.py` y del modelo
`RAC/models/historial_personal_models.py::PrestamoCargo`.
"""
from apps.cargos.application.dtos.cargos_dtos import PrestamoCargoDTO
from apps.cargos.domain.ports.repo_cargos import RepoCargos


def _prestamo_a_dto(entidad) -> PrestamoCargoDTO:
    return PrestamoCargoDTO(
        id=entidad.id,
        empleado_encargado_cedula=entidad.empleado_encargado_cedula,
        empleado_encargado_nombre=entidad.empleado_encargado_nombre,
        cargo_encargado_id=entidad.cargo_encargado_id,
        cargo_encargado_codigo=entidad.cargo_encargado_codigo,
        titular_cedula=entidad.titular_cedula,
        titular_nombre=entidad.titular_nombre,
        motivo_id=entidad.motivo_id,
        motivo_nombre=entidad.motivo_nombre,
        estatus_id=entidad.estatus_id,
        estatus_nombre=entidad.estatus_nombre,
        fecha_inicio=entidad.fecha_inicio,
        fecha_fin=entidad.fecha_fin,
        ejecutado_por_id=entidad.ejecutado_por_id,
        esta_finalizada=entidad.esta_finalizada,
    )


def listar_prestamos(repo: RepoCargos, solo_activos: bool = False) -> list[PrestamoCargoDTO]:
    return [_prestamo_a_dto(e) for e in repo.listar_prestamos(solo_activos=solo_activos)]


def crear_prestamo(
    repo: RepoCargos,
    cedula_encargado: str,
    cargo_id: int,
    motivo_id: int,
    fecha_inicio: str,
    fecha_fin: str,
    usuario_id: int,
) -> PrestamoCargoDTO:
    entidad = repo.crear_prestamo(
        cedula_encargado=cedula_encargado,
        cargo_id=cargo_id,
        motivo_id=motivo_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        usuario_id=usuario_id,
    )
    return _prestamo_a_dto(entidad)


def finalizar_prestamo(repo: RepoCargos, prestamo_id: int) -> PrestamoCargoDTO:
    entidad = repo.finalizar_prestamo(prestamo_id=prestamo_id)
    return _prestamo_a_dto(entidad)
