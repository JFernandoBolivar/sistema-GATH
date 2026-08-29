"""
Mappers de Catálogos.
"""
from apps.catalogos.domain.entities.catalogo_item import CatalogoItem
from apps.catalogos.domain.entities.geografia import Estado, Municipio, Parroquia, Region
from apps.catalogos.infrastructure.models.catalogo_models import (
    CategoriaMovimientoModel,
    EstatusModel,
    GradoModel,
    ParentescoModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
    TipoProcedenciaModel,
)
from apps.catalogos.infrastructure.models.geografia_models import (
    EstadoModel,
    MunicipioModel,
    ParroquiaModel,
    RegionModel,
)


def region_a_entidad(modelo: RegionModel) -> Region:
    return Region(id=modelo.pk, nombre=modelo.region)


def estado_a_entidad(modelo: EstadoModel) -> Estado:
    return Estado(id=modelo.pk, nombre=modelo.estado, region_id=modelo.Region_id)


def municipio_a_entidad(modelo: MunicipioModel) -> Municipio:
    return Municipio(id=modelo.pk, nombre=modelo.municipio, estado_id=modelo.estadoid_id)


def parroquia_a_entidad(modelo: ParroquiaModel) -> Parroquia:
    return Parroquia(id=modelo.pk, nombre=modelo.parroquia, municipio_id=modelo.municipioid_id)


def sexo_a_entidad(modelo: SexoModel) -> CatalogoItem:
    return CatalogoItem(id=modelo.pk, nombre=modelo.sexo)


def estatus_a_entidad(modelo: EstatusModel) -> CatalogoItem:
    return CatalogoItem(id=modelo.pk, nombre=modelo.estatus)


def tipo_personal_a_entidad(modelo: TipoPersonalModel) -> CatalogoItem:
    return CatalogoItem(id=modelo.pk, nombre=modelo.tipo_personal)


def tipo_nomina_a_entidad(modelo: TipoNominaModel) -> CatalogoItem:
    return CatalogoItem(
        id=modelo.pk,
        nombre=modelo.nomina,
        extra={'requiere_codigo': modelo.requiere_codig, 'es_activo': modelo.es_activo},
    )


def parentesco_a_entidad(modelo: ParentescoModel) -> CatalogoItem:
    return CatalogoItem(id=modelo.pk, nombre=modelo.parentesco)


def tipo_procedencia_a_entidad(modelo: TipoProcedenciaModel) -> CatalogoItem:
    return CatalogoItem(id=modelo.pk, nombre=modelo.tipo_procedencia)


def grado_a_entidad(modelo: GradoModel) -> CatalogoItem:
    return CatalogoItem(id=modelo.pk, nombre=modelo.grado)


def categoria_movimiento_a_entidad(modelo: CategoriaMovimientoModel) -> CatalogoItem:
    return CatalogoItem(id=modelo.pk, nombre=modelo.categoria)


def tipo_movimiento_a_entidad(modelo: TipoMovimientoModel) -> CatalogoItem:
    return CatalogoItem(
        id=modelo.pk,
        nombre=modelo.movimiento,
        extra={'categoria': modelo.categoria.categoria if modelo.categoria_id else None},
    )
