"""
Casos de uso para consultar y activar plantillas de carnet.
"""
from apps.carnetizacion.application.dtos.carnetizacion_dtos import PlantillaCarnetDTO
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion


def _plantilla_a_dto(p: PlantillaCarnet) -> PlantillaCarnetDTO:
    return PlantillaCarnetDTO(
        id=p.id,
        nombre=p.nombre,
        imagen_url=p.imagen_url,
        activo=p.activo,
        creado=p.creado,
    )


def listar_plantillas(repo: RepoCarnetizacion) -> list[PlantillaCarnetDTO]:
    entidades = repo.listar_plantillas()
    return [_plantilla_a_dto(e) for e in entidades]


def activar_plantilla(repo: RepoCarnetizacion, plantilla_id: int) -> PlantillaCarnetDTO:
    entidad = repo.activar_plantilla(plantilla_id)
    return _plantilla_a_dto(entidad)
