"""
Casos de uso para consultar y emitir carnets.
"""
from apps.carnetizacion.application.dtos.carnetizacion_dtos import CarnetDTO
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion


def _carnet_a_dto(c: Carnet) -> CarnetDTO:
    return CarnetDTO(
        id=c.id,
        empleado_cedula=c.empleado_cedula,
        empleado_nombres=c.empleado_nombres,
        empleado_apellidos=c.empleado_apellidos,
        security_hash=c.security_hash,
        fecha_emision=c.fecha_emision,
        motivo_id=c.motivo_id,
        motivo_nombre=c.motivo_nombre,
        activo=c.activo,
        observaciones=c.observaciones,
    )


def listar_carnets(
    repo: RepoCarnetizacion, empleado_cedula: str | None = None
) -> list[CarnetDTO]:
    entidades = repo.listar_carnets(empleado_cedula=empleado_cedula)
    return [_carnet_a_dto(e) for e in entidades]


def emitir_carnet(
    repo: RepoCarnetizacion,
    empleado_cedula: str,
    motivo_id: int,
    observaciones: str | None = None,
) -> CarnetDTO:
    entidad = repo.emitir_carnet(
        empleado_cedula=empleado_cedula,
        motivo_id=motivo_id,
        observaciones=observaciones,
    )
    return _carnet_a_dto(entidad)
