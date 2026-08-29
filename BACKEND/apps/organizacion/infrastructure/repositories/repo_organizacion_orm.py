"""
Repositorio ORM de Organización (Reglas B4, B7).
Único punto del módulo que interactúa con la base de datos PostgreSQL.
"""
from apps.organizacion.domain.entities.coordinacion import Coordinacion
from apps.organizacion.domain.entities.dependencia import Dependencia
from apps.organizacion.domain.entities.direccion_general import DireccionGeneral
from apps.organizacion.domain.entities.direccion_linea import DireccionLinea
from apps.organizacion.domain.entities.organismo_adscrito import OrganismoAdscrito
from apps.organizacion.infrastructure.mappers.mapper_organizacion import (
    coordinacion_a_entidad,
    dependencia_a_entidad,
    direccion_general_a_entidad,
    direccion_linea_a_entidad,
    organismo_a_entidad,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
    OrganismoAdscritoModel,
)


class RepoOrganizacionORM:
    def listar_dependencias(self) -> list[Dependencia]:
        qs = DependenciaModel.objects.all().order_by('Codigo')
        return [dependencia_a_entidad(d) for d in qs]

    def obtener_dependencia(self, dependencia_id: int) -> Dependencia | None:
        fila = DependenciaModel.objects.filter(pk=dependencia_id).first()
        return dependencia_a_entidad(fila) if fila else None

    def listar_direcciones_generales(
        self, dependencia_id: int | None = None
    ) -> list[DireccionGeneral]:
        qs = DireccionGeneralModel.objects.all().order_by('Codigo')
        if dependencia_id is not None:
            qs = qs.filter(dependenciaId_id=dependencia_id)
        return [direccion_general_a_entidad(dg) for dg in qs]

    def listar_direcciones_linea(
        self, direccion_general_id: int | None = None
    ) -> list[DireccionLinea]:
        qs = DireccionLineaModel.objects.all().order_by('Codigo')
        if direccion_general_id is not None:
            qs = qs.filter(direccionGeneral_id=direccion_general_id)
        return [direccion_linea_a_entidad(dl) for dl in qs]

    def listar_coordinaciones(
        self,
        direccion_linea_id: int | None = None,
        direccion_general_id: int | None = None,
    ) -> list[Coordinacion]:
        qs = CoordinacionModel.objects.all().order_by('Codigo')
        if direccion_linea_id is not None:
            qs = qs.filter(direccionLinea_id=direccion_linea_id)
        if direccion_general_id is not None:
            qs = qs.filter(direccionGeneral_id=direccion_general_id)
        return [coordinacion_a_entidad(c) for c in qs]

    def listar_organismos_adscritos(self) -> list[OrganismoAdscrito]:
        qs = OrganismoAdscritoModel.objects.all().order_by('Organismoadscrito')
        return [organismo_a_entidad(o) for o in qs]
