"""
Caso de uso para crear un código de posición vacante (sin asignar), réplica
funcional de la pantalla "Crear Nuevo Código" del legado.
"""
from apps.cargos.application.dtos.cargos_dtos import CargoAsignacionDTO, CrearCargoDTO
from apps.cargos.application.use_cases.listar_cargos import _a_dto
from apps.cargos.domain.ports.repo_cargos import RepoCargos
from core.domain.exceptions import ValidationError


def validar_ubicacion_minima(dependencia_id: int | None, direccion_general_id: int | None) -> None:
    """
    Un código de posición no puede crearse solo con el Nivel (Dependencia): debe
    indicar también la Dirección / Gerencia / Oficina. Cada error va asociado
    a su campo para que el formulario lo marque.
    """
    if not dependencia_id:
        raise ValidationError('Seleccione el Nivel (Dependencia).', campo='dependencia_id')
    if not direccion_general_id:
        raise ValidationError(
            'Seleccione la Dirección / Gerencia / Oficina: el código no puede crearse solo con el Nivel.',
            campo='direccion_general_id',
        )


def crear_cargo(repo: RepoCargos, dto: CrearCargoDTO) -> CargoAsignacionDTO:
    validar_ubicacion_minima(dto.dependencia_id, dto.direccion_general_id)
    entidad = repo.crear_cargo({
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
    })
    return _a_dto(entidad)
