"""
Casos de uso de gestión de la organización (crear, actualizar, eliminar).
Reglas B2/B4: puros, reciben el puerto por inyección, sin ORM.
"""
from apps.organizacion.domain.ports.repo_organizacion import RepoOrganizacion


def crear_dependencia(repo: RepoOrganizacion, codigo: str, nombre: str):
    return repo.crear_dependencia(codigo=codigo, nombre=nombre)


def actualizar_dependencia(repo: RepoOrganizacion, dependencia_id: int, codigo: str, nombre: str):
    return repo.actualizar_dependencia(dependencia_id, codigo=codigo, nombre=nombre)


def eliminar_dependencia(repo: RepoOrganizacion, dependencia_id: int) -> None:
    repo.eliminar_dependencia(dependencia_id)


def crear_direccion_general(repo: RepoOrganizacion, codigo: str, nombre: str, dependencia_id: int | None):
    return repo.crear_direccion_general(codigo=codigo, nombre=nombre, dependencia_id=dependencia_id)


def actualizar_direccion_general(repo: RepoOrganizacion, direccion_general_id: int, codigo: str, nombre: str, dependencia_id: int | None):
    return repo.actualizar_direccion_general(direccion_general_id, codigo=codigo, nombre=nombre, dependencia_id=dependencia_id)


def eliminar_direccion_general(repo: RepoOrganizacion, direccion_general_id: int) -> None:
    repo.eliminar_direccion_general(direccion_general_id)


def crear_direccion_linea(repo: RepoOrganizacion, codigo: str, nombre: str, direccion_general_id: int | None):
    return repo.crear_direccion_linea(codigo=codigo, nombre=nombre, direccion_general_id=direccion_general_id)


def actualizar_direccion_linea(repo: RepoOrganizacion, direccion_linea_id: int, codigo: str, nombre: str, direccion_general_id: int | None):
    return repo.actualizar_direccion_linea(direccion_linea_id, codigo=codigo, nombre=nombre, direccion_general_id=direccion_general_id)


def eliminar_direccion_linea(repo: RepoOrganizacion, direccion_linea_id: int) -> None:
    repo.eliminar_direccion_linea(direccion_linea_id)


def crear_coordinacion(repo: RepoOrganizacion, codigo: str, nombre: str, direccion_linea_id: int | None):
    return repo.crear_coordinacion(codigo=codigo, nombre=nombre, direccion_linea_id=direccion_linea_id)


def actualizar_coordinacion(repo: RepoOrganizacion, coordinacion_id: int, codigo: str, nombre: str, direccion_linea_id: int | None):
    return repo.actualizar_coordinacion(coordinacion_id, codigo=codigo, nombre=nombre, direccion_linea_id=direccion_linea_id)


def eliminar_coordinacion(repo: RepoOrganizacion, coordinacion_id: int) -> None:
    repo.eliminar_coordinacion(coordinacion_id)


def crear_organismo_adscrito(repo: RepoOrganizacion, nombre: str, parent_id: int | None):
    return repo.crear_organismo_adscrito(nombre=nombre, parent_id=parent_id)


def actualizar_organismo_adscrito(repo: RepoOrganizacion, organismo_id: int, nombre: str, parent_id: int | None):
    return repo.actualizar_organismo_adscrito(organismo_id, nombre=nombre, parent_id=parent_id)


def eliminar_organismo_adscrito(repo: RepoOrganizacion, organismo_id: int) -> None:
    repo.eliminar_organismo_adscrito(organismo_id)
