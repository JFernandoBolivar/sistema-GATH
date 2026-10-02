"""
Caso de uso: Actualizar Cargo (atributos de cargo, nómina, grado, ubicación).
Réplica funcional de `update_position` (`PUT /api/codigos/<id>/`) del legado.
"""
from apps.cargos.application.dtos.cargos_dtos import CargoAsignacionDTO
from apps.cargos.domain.ports.repo_cargos import RepoCargos


def actualizar_cargo(
    repo: RepoCargos,
    cargo_id: int,
    datos: dict,
    usuario_id: int | None = None,
) -> CargoAsignacionDTO:
    entidad = repo.actualizar_cargo(cargo_id=cargo_id, datos=datos, usuario_id=usuario_id)
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
        organismo_id=entidad.organismo_id,
        organismo_nombre=entidad.organismo_nombre,
        grado_id=entidad.grado_id,
        grado_nombre=entidad.grado_nombre,
        observaciones=entidad.observaciones,
        esta_vacante=entidad.esta_vacante,
        fecha_actualizacion=entidad.fecha_actualizacion,
    )
