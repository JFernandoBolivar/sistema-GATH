"""
Mappers de Organización.
Transforman filas ORM Django a entidades de dominio puras.
"""
from apps.organizacion.domain.entities.coordinacion import Coordinacion
from apps.organizacion.domain.entities.dependencia import Dependencia
from apps.organizacion.domain.entities.direccion_general import DireccionGeneral
from apps.organizacion.domain.entities.direccion_linea import DireccionLinea
from apps.organizacion.domain.entities.organismo_adscrito import OrganismoAdscrito
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
    OrganismoAdscritoModel,
)


def dependencia_a_entidad(modelo: DependenciaModel) -> Dependencia:
    return Dependencia(
        id=modelo.pk,
        codigo=modelo.Codigo,
        nombre=modelo.dependencia,
    )


def direccion_general_a_entidad(modelo: DireccionGeneralModel) -> DireccionGeneral:
    return DireccionGeneral(
        id=modelo.pk,
        codigo=modelo.Codigo,
        nombre=modelo.direccion_general,
        dependencia_id=modelo.dependenciaId_id,
    )


def direccion_linea_a_entidad(modelo: DireccionLineaModel) -> DireccionLinea:
    return DireccionLinea(
        id=modelo.pk,
        codigo=modelo.Codigo,
        nombre=modelo.direccion_linea,
        direccion_general_id=modelo.direccionGeneral_id,
    )


def coordinacion_a_entidad(modelo: CoordinacionModel) -> Coordinacion:
    return Coordinacion(
        id=modelo.pk,
        codigo=modelo.Codigo,
        nombre=modelo.coordinacion,
        direccion_linea_id=modelo.direccionLinea_id,
    )


def organismo_a_entidad(modelo: OrganismoAdscritoModel) -> OrganismoAdscrito:
    return OrganismoAdscrito(
        id=modelo.pk,
        nombre=modelo.Organismoadscrito,
        parent_id=modelo.parent_id,
    )
