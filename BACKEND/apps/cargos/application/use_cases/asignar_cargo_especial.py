"""
Caso de uso para la asignación de cargo especial con código autogenerable
(gap #3 de la migración funcional de personal/activo).

Réplica funcional de
`RAC/serializers/personal_activo_serializers.py::SpecialPositionAutoCreateSerializer`.
"""
from apps.cargos.application.dtos.cargos_dtos import CargoAsignacionDTO, CrearCargoEspecialDTO
from apps.cargos.application.use_cases.listar_cargos import _a_dto
from apps.cargos.domain.ports.repo_cargos import RepoCargos


def asignar_cargo_especial(
    repo: RepoCargos, dto: CrearCargoEspecialDTO, usuario_id: int | None = None
) -> CargoAsignacionDTO:
    entidad = repo.crear_cargo_especial_y_asignar({
        'cedula_empleado': dto.cedula_empleado,
        'denominacion_id': dto.denominacion_id,
        'especifica_id': dto.especifica_id,
        'tipo_nomina_id': dto.tipo_nomina_id,
        'dependencia_id': dto.dependencia_id,
        'direccion_general_id': dto.direccion_general_id,
        'direccion_linea_id': dto.direccion_linea_id,
        'coordinacion_id': dto.coordinacion_id,
        'organismo_id': dto.organismo_id,
        'grado_id': dto.grado_id,
        'observaciones': dto.observaciones,
        'usuario_id': usuario_id,
    })
    return _a_dto(entidad)
