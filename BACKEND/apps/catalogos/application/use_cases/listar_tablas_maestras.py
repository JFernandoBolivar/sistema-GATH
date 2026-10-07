"""
Casos de uso para consulta de tablas maestras institucionales.
"""
from apps.catalogos.application.dtos.catalogos_dtos import CatalogoItemDTO
from apps.catalogos.domain.ports.repo_catalogos import RepoCatalogos


def _convertir(items) -> list[CatalogoItemDTO]:
    return [
        CatalogoItemDTO(
            id=item.id,
            nombre=item.nombre,
            codigo=item.codigo,
            extra=item.extra,
        )
        for item in items
    ]


def listar_sexos(repo: RepoCatalogos) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_sexos())


def listar_estatus(repo: RepoCatalogos) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_estatus())


def listar_tipos_personal(repo: RepoCatalogos) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_tipos_personal())


def listar_tipos_nomina(
    repo: RepoCatalogos, solo_especiales: bool = False, solo_pasivos: bool = False
) -> list[CatalogoItemDTO]:
    try:
        entidades = repo.listar_tipos_nomina(solo_especiales=solo_especiales, solo_pasivos=solo_pasivos)
    except TypeError:
        try:
            entidades = repo.listar_tipos_nomina(solo_especiales=solo_especiales)
        except TypeError:
            entidades = repo.listar_tipos_nomina()
    return _convertir(entidades)


def listar_parentescos(repo: RepoCatalogos) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_parentescos())


def listar_tipos_procedencia(repo: RepoCatalogos) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_tipos_procedencia())


def listar_estados_civiles(repo: RepoCatalogos) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_estados_civiles())


def listar_grados(repo: RepoCatalogos) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_grados())


def listar_categorias_movimiento(repo: RepoCatalogos) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_categorias_movimiento())


def listar_tipos_movimiento(repo: RepoCatalogos, categoria: str | None = None) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_tipos_movimiento(categoria=categoria))


def listar_nacionalidades(repo: RepoCatalogos) -> list[CatalogoItemDTO]:
    return _convertir(repo.listar_nacionalidades())

