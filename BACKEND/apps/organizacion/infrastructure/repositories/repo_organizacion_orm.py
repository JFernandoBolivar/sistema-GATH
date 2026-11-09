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

    def crear_dependencia(self, codigo: str, nombre: str) -> Dependencia:
        fila = DependenciaModel.objects.create(Codigo=codigo, dependencia=nombre)
        return dependencia_a_entidad(fila)

    def actualizar_dependencia(self, dependencia_id: int, codigo: str, nombre: str) -> Dependencia:
        fila = DependenciaModel.objects.get(pk=dependencia_id)
        fila.Codigo = codigo
        fila.dependencia = nombre
        fila.save(update_fields=['Codigo', 'dependencia'])
        return dependencia_a_entidad(fila)

    def eliminar_dependencia(self, dependencia_id: int) -> None:
        DependenciaModel.objects.filter(pk=dependencia_id).delete()

    def listar_direcciones_generales(
        self, dependencia_id: int | None = None
    ) -> list[DireccionGeneral]:
        qs = DireccionGeneralModel.objects.all().order_by('Codigo')
        if dependencia_id is not None:
            qs = qs.filter(dependenciaId_id=dependencia_id)
        return [direccion_general_a_entidad(dg) for dg in qs]

    def crear_direccion_general(self, codigo: str, nombre: str, dependencia_id: int | None) -> DireccionGeneral:
        dep_id = DependenciaModel.objects.filter(pk=dependencia_id).first() if dependencia_id else None
        fila = DireccionGeneralModel.objects.create(Codigo=codigo, direccion_general=nombre, dependenciaId=dep_id)
        return direccion_general_a_entidad(fila)

    def actualizar_direccion_general(self, direccion_general_id: int, codigo: str, nombre: str, dependencia_id: int | None) -> DireccionGeneral:
        fila = DireccionGeneralModel.objects.get(pk=direccion_general_id)
        fila.Codigo = codigo
        fila.direccion_general = nombre
        fila.dependenciaId = DependenciaModel.objects.filter(pk=dependencia_id).first() if dependencia_id else None
        fila.save(update_fields=['Codigo', 'direccion_general', 'dependenciaId'])
        return direccion_general_a_entidad(fila)

    def eliminar_direccion_general(self, direccion_general_id: int) -> None:
        DireccionGeneralModel.objects.filter(pk=direccion_general_id).delete()

    def listar_direcciones_linea(
        self, direccion_general_id: int | None = None
    ) -> list[DireccionLinea]:
        qs = DireccionLineaModel.objects.all().order_by('Codigo')
        if direccion_general_id is not None:
            qs = qs.filter(direccionGeneral_id=direccion_general_id)
        return [direccion_linea_a_entidad(dl) for dl in qs]

    def crear_direccion_linea(self, codigo: str, nombre: str, direccion_general_id: int | None) -> DireccionLinea:
        dg = DireccionGeneralModel.objects.filter(pk=direccion_general_id).first() if direccion_general_id else None
        fila = DireccionLineaModel.objects.create(Codigo=codigo, direccion_linea=nombre, direccionGeneral=dg)
        return direccion_linea_a_entidad(fila)

    def actualizar_direccion_linea(self, direccion_linea_id: int, codigo: str, nombre: str, direccion_general_id: int | None) -> DireccionLinea:
        fila = DireccionLineaModel.objects.get(pk=direccion_linea_id)
        fila.Codigo = codigo
        fila.direccion_linea = nombre
        fila.direccionGeneral = DireccionGeneralModel.objects.filter(pk=direccion_general_id).first() if direccion_general_id else None
        fila.save(update_fields=['Codigo', 'direccion_linea', 'direccionGeneral'])
        return direccion_linea_a_entidad(fila)

    def eliminar_direccion_linea(self, direccion_linea_id: int) -> None:
        DireccionLineaModel.objects.filter(pk=direccion_linea_id).delete()

    def listar_coordinaciones(
        self,
        direccion_linea_id: int | None = None,
        direccion_general_id: int | None = None,
    ) -> list[Coordinacion]:
        qs = CoordinacionModel.objects.all().order_by('Codigo')
        if direccion_linea_id is not None:
            qs = qs.filter(direccionLinea_id=direccion_linea_id)
        return [coordinacion_a_entidad(c) for c in qs]

    def crear_coordinacion(self, codigo: str, nombre: str, direccion_linea_id: int | None) -> Coordinacion:
        dl = DireccionLineaModel.objects.filter(pk=direccion_linea_id).first() if direccion_linea_id else None
        fila = CoordinacionModel.objects.create(Codigo=codigo, coordinacion=nombre, direccionLinea=dl)
        return coordinacion_a_entidad(fila)

    def actualizar_coordinacion(self, coordinacion_id: int, codigo: str, nombre: str, direccion_linea_id: int | None) -> Coordinacion:
        fila = CoordinacionModel.objects.get(pk=coordinacion_id)
        fila.Codigo = codigo
        fila.coordinacion = nombre
        fila.direccionLinea = DireccionLineaModel.objects.filter(pk=direccion_linea_id).first() if direccion_linea_id else None
        fila.save(update_fields=['Codigo', 'coordinacion', 'direccionLinea'])
        return coordinacion_a_entidad(fila)

    def eliminar_coordinacion(self, coordinacion_id: int) -> None:
        CoordinacionModel.objects.filter(pk=coordinacion_id).delete()

    def listar_organismos_adscritos(self) -> list[OrganismoAdscrito]:
        qs = OrganismoAdscritoModel.objects.all().order_by('Organismoadscrito')
        return [organismo_a_entidad(o) for o in qs]

    def crear_organismo_adscrito(self, nombre: str, parent_id: int | None) -> OrganismoAdscrito:
        parent = OrganismoAdscritoModel.objects.filter(pk=parent_id).first() if parent_id else None
        fila = OrganismoAdscritoModel.objects.create(Organismoadscrito=nombre, parent=parent)
        return organismo_a_entidad(fila)

    def actualizar_organismo_adscrito(self, organismo_id: int, nombre: str, parent_id: int | None) -> OrganismoAdscrito:
        fila = OrganismoAdscritoModel.objects.get(pk=organismo_id)
        fila.Organismoadscrito = nombre
        fila.parent = OrganismoAdscritoModel.objects.filter(pk=parent_id).first() if parent_id else None
        fila.save(update_fields=['Organismoadscrito', 'parent'])
        return organismo_a_entidad(fila)

    def eliminar_organismo_adscrito(self, organismo_id: int) -> None:
        OrganismoAdscritoModel.objects.filter(pk=organismo_id).delete()
