"""
Repositorio ORM de Catálogos (Reglas B4, B7).
"""
from apps.catalogos.domain.entities.catalogo_item import CatalogoItem
from apps.catalogos.domain.entities.geografia import Estado, Municipio, Parroquia, Region
from apps.catalogos.infrastructure.mappers.mapper_catalogos import (
    categoria_movimiento_a_entidad,
    estado_a_entidad,
    estatus_a_entidad,
    grado_a_entidad,
    municipio_a_entidad,
    parentesco_a_entidad,
    parroquia_a_entidad,
    region_a_entidad,
    sexo_a_entidad,
    tipo_movimiento_a_entidad,
    tipo_nomina_a_entidad,
    tipo_personal_a_entidad,
    tipo_procedencia_a_entidad,
)
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
    EstadoCivilModel,
)
from apps.catalogos.infrastructure.models.geografia_models import (
    EstadoModel,
    MunicipioModel,
    ParroquiaModel,
    RegionModel,
)


class RepoCatalogosORM:
    def listar_regiones(self) -> list[Region]:
        return [region_a_entidad(r) for r in RegionModel.objects.all().order_by('region')]

    def listar_estados(self, region_id: int | None = None) -> list[Estado]:
        qs = EstadoModel.objects.all().order_by('estado')
        if region_id is not None:
            qs = qs.filter(Region_id=region_id)
        return [estado_a_entidad(e) for e in qs]

    def listar_municipios(self, estado_id: int | None = None) -> list[Municipio]:
        qs = MunicipioModel.objects.all().order_by('municipio')
        if estado_id is not None:
            qs = qs.filter(estadoid_id=estado_id)
        return [municipio_a_entidad(m) for m in qs]

    def listar_parroquias(self, municipio_id: int | None = None) -> list[Parroquia]:
        qs = ParroquiaModel.objects.all().order_by('parroquia')
        if municipio_id is not None:
            qs = qs.filter(municipioid_id=municipio_id)
        return [parroquia_a_entidad(p) for p in qs]

    def listar_sexos(self) -> list[CatalogoItem]:
        return [sexo_a_entidad(s) for s in SexoModel.objects.all().order_by('sexo')]

    def listar_estatus(self) -> list[CatalogoItem]:
        return [estatus_a_entidad(e) for e in EstatusModel.objects.all().order_by('estatus')]

    def listar_tipos_personal(self) -> list[CatalogoItem]:
        return [tipo_personal_a_entidad(tp) for tp in TipoPersonalModel.objects.all().order_by('tipo_personal')]

    def listar_tipos_nomina(
        self, solo_especiales: bool = False, solo_pasivos: bool = False
    ) -> list[CatalogoItem]:
        qs = TipoNominaModel.objects.all().order_by('nomina')
        if solo_especiales:
            qs = qs.filter(requiere_codig=True)
        if solo_pasivos:
            qs = qs.filter(es_activo=False)
        return [tipo_nomina_a_entidad(tn) for tn in qs]

    def listar_parentescos(self) -> list[CatalogoItem]:
        return [parentesco_a_entidad(p) for p in ParentescoModel.objects.all().order_by('descripcion_parentesco')]

    def listar_tipos_procedencia(self) -> list[CatalogoItem]:
        return [tipo_procedencia_a_entidad(tp) for tp in TipoProcedenciaModel.objects.all().order_by('tipo_procedencia')]

    def listar_estados_civiles(self) -> list[CatalogoItem]:
        return [
            CatalogoItem(id=e.pk, nombre=e.estadoCivil)
            for e in EstadoCivilModel.objects.all().order_by('estadoCivil')
        ]

    def listar_grados(self) -> list[CatalogoItem]:
        return [grado_a_entidad(g) for g in GradoModel.objects.all().order_by('grado')]

    def listar_categorias_movimiento(self) -> list[CatalogoItem]:
        qs = CategoriaMovimientoModel.objects.all().order_by('categoria')
        return [categoria_movimiento_a_entidad(c) for c in qs]

    def listar_tipos_movimiento(self, categoria: str | None = None) -> list[CatalogoItem]:
        qs = TipoMovimientoModel.objects.select_related('categoria').all().order_by('movimiento')
        if categoria is not None:
            qs = qs.filter(categoria__categoria__iexact=categoria)
        return [tipo_movimiento_a_entidad(t) for t in qs]
