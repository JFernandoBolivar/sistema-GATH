"""
Casos de uso de gestión de denominaciones de cargos (crear, actualizar, eliminar).
Reglas B2/B4: puros, reciben el puerto por inyección, sin ORM.
"""
from apps.cargos.domain.ports.repo_cargos import RepoCargos


def crear_denominacion(repo: RepoCargos, nombre: str, orden: int):
    return repo.crear_denominacion(nombre=nombre, orden=orden)


def actualizar_denominacion(repo: RepoCargos, denominacion_id: int, nombre: str, orden: int):
    return repo.actualizar_denominacion(denominacion_id, nombre=nombre, orden=orden)


def eliminar_denominacion(repo: RepoCargos, denominacion_id: int) -> None:
    repo.eliminar_denominacion(denominacion_id)


def crear_denominacion_especifica(repo: RepoCargos, nombre: str, orden: int):
    return repo.crear_denominacion_especifica(nombre=nombre, orden=orden)


def actualizar_denominacion_especifica(repo: RepoCargos, denominacion_id: int, nombre: str, orden: int):
    return repo.actualizar_denominacion_especifica(denominacion_id, nombre=nombre, orden=orden)


def eliminar_denominacion_especifica(repo: RepoCargos, denominacion_id: int) -> None:
    repo.eliminar_denominacion_especifica(denominacion_id)
