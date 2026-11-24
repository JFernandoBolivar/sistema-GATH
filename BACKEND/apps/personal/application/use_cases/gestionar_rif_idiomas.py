"""
Casos de uso de la ficha: RR. HH. corrige el RIF y los idiomas de un trabajador (activo o pasivo).
"""
from dataclasses import dataclass

from apps.personal.domain.ports.repo_rif_idiomas import RepoRifIdiomas
from apps.personal.domain.value_objects.idiomas import normalizar_idiomas
from apps.personal.domain.value_objects.rif import normalizar_rif
from core.domain.exceptions import NotFoundError


@dataclass(frozen=True)
class CambioRif:
    previo: str | None
    nuevo: str | None


@dataclass(frozen=True)
class CambioIdiomas:
    previos: list[dict]
    nuevos: list[dict]


def _exigir(repo: RepoRifIdiomas, cedula: str) -> None:
    if not repo.existe_trabajador(cedula):
        raise NotFoundError(f"Trabajador con cédula {cedula} no encontrado")


def actualizar_rif(repo: RepoRifIdiomas, *, cedula: str, rif) -> CambioRif:
    """`rif` vacío lo borra. Lanza `ValidationError` si el formato no es el venezolano."""
    nuevo = normalizar_rif(rif) or None
    _exigir(repo, cedula)
    previo = repo.rif_de(cedula)
    repo.guardar_rif(cedula, nuevo)
    return CambioRif(previo=previo, nuevo=nuevo)


def consultar_idiomas(repo: RepoRifIdiomas, *, cedula: str) -> list[dict]:
    _exigir(repo, cedula)
    return repo.idiomas_de(cedula)


def reemplazar_idiomas(repo: RepoRifIdiomas, *, cedula: str, idiomas) -> CambioIdiomas:
    """La lista enviada REEMPLAZA a la actual (vacía = ninguno)."""
    limpios = normalizar_idiomas(idiomas)
    _exigir(repo, cedula)
    previos = repo.idiomas_de(cedula)
    repo.reemplazar_idiomas(cedula, limpios)
    return CambioIdiomas(previos=previos, nuevos=repo.idiomas_de(cedula))
