"""
Caso de uso para revocar un carnet emitido (Fase 2.3 del plan de reparación,
`PLAN_REPARACION_GATH.md`) — el permiso `carnetizacion.revocar` ya estaba
sembrado en el catálogo pero sin caso de uso ni vista detrás.
"""
from apps.carnetizacion.application.dtos.carnetizacion_dtos import CarnetDTO
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion


def revocar_carnet(repo: RepoCarnetizacion, carnet_id: int) -> CarnetDTO:
    entidad = repo.revocar_carnet(carnet_id)
    return CarnetDTO(
        id=entidad.id,
        empleado_cedula=entidad.empleado_cedula,
        empleado_nombres=entidad.empleado_nombres,
        empleado_apellidos=entidad.empleado_apellidos,
        security_hash=entidad.security_hash,
        fecha_emision=entidad.fecha_emision,
        motivo_id=entidad.motivo_id,
        motivo_nombre=entidad.motivo_nombre,
        activo=entidad.activo,
        observaciones=entidad.observaciones,
    )
