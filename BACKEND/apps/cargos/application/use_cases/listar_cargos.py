"""
Casos de uso para consultar puestos de trabajo y vacantes.
"""
from apps.cargos.application.dtos.cargos_dtos import CargoAsignacionDTO
from apps.cargos.domain.ports.repo_cargos import RepoCargos


def _a_dto(entidad) -> CargoAsignacionDTO:
    return CargoAsignacionDTO(
        id=entidad.id,
        codigo=entidad.codigo,
        empleado_cedula=entidad.empleado_cedula,
        denominacion_id=entidad.denominacion_id,
        denominacion_nombre=entidad.denominacion_nombre,
        especifica_id=entidad.especifica_id,
        especifica_nombre=entidad.especifica_nombre,
        tipo_nomina_id=entidad.tipo_nomina_id,
        tipo_nomina_nombre=entidad.tipo_nomina_nombre,
        estatus_id=entidad.estatus_id,
        estatus_nombre=entidad.estatus_nombre,
        dependencia_id=entidad.dependencia_id,
        dependencia_nombre=entidad.dependencia_nombre,
        direccion_general_id=entidad.direccion_general_id,
        direccion_general_nombre=entidad.direccion_general_nombre,
        direccion_linea_id=entidad.direccion_linea_id,
        direccion_linea_nombre=entidad.direccion_linea_nombre,
        coordinacion_id=entidad.coordinacion_id,
        coordinacion_nombre=entidad.coordinacion_nombre,
        observaciones=entidad.observaciones,
        esta_vacante=entidad.esta_vacante,
    )


def listar_cargos(
    repo: RepoCargos,
    tipo_nomina_id: int | None = None,
    dependencia_id: int | None = None,
    solo_vacantes: bool = False,
) -> list[CargoAsignacionDTO]:
    entidades = repo.listar_cargos(
        tipo_nomina_id=tipo_nomina_id,
        dependencia_id=dependencia_id,
        solo_vacantes=solo_vacantes,
    )
    return [_a_dto(e) for e in entidades]
