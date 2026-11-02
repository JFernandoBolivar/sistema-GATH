from apps.autogestion.domain.ports.repo_catalogos_lectura import CLAVES_CATALOGO, RepoCatalogosLectura
from core.domain.exceptions import NotFoundError


def listar_catalogo_autogestion(repo: RepoCatalogosLectura, clave: str, padre_id: int | None = None) -> list[dict]:
    if clave not in CLAVES_CATALOGO:
        raise NotFoundError('Catálogo no encontrado.')
    return repo.listar(clave, padre_id)
