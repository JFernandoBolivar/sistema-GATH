"""
Caso de uso: RR. HH. corrige «¿tiene hijos?» en la ficha de un trabajador (activo o pasivo).
"""
from dataclasses import dataclass

from core.domain.exceptions import NotFoundError
from apps.personal.domain.ports.repo_tiene_hijos import RepoTieneHijos


@dataclass(frozen=True)
class CambioTieneHijos:
    previo: bool | None
    nuevo: bool | None


def actualizar_tiene_hijos(
    repo: RepoTieneHijos, *, cedula: str, tiene_hijos: bool | None, actor_cedula: str,
) -> CambioTieneHijos:
    if not repo.existe_trabajador(cedula):
        raise NotFoundError(f"Trabajador con cédula {cedula} no encontrado")
    previo = repo.obtener(cedula)
    nuevo = repo.guardar(cedula, tiene_hijos, actor_cedula)
    return CambioTieneHijos(previo=previo, nuevo=nuevo)
