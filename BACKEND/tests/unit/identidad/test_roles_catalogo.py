"""
Tests del CRUD del catálogo de roles (cierra CRIT-12) con repositorio en memoria.
"""
import pytest

from apps.identidad.application.dtos.rol_dto import ActualizarRolDTO, CrearRolDTO
from apps.identidad.application.use_cases.actualizar_rol import actualizar_rol
from apps.identidad.application.use_cases.crear_rol import crear_rol, normalizar_nombre_rol
from apps.identidad.application.use_cases.eliminar_rol import eliminar_rol
from apps.identidad.application.use_cases.listar_roles import listar_roles
from apps.identidad.domain.entities.rol import Rol
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from tests.unit.identidad.conftest import RepoRolesMemoria


def test_lista_el_catalogo_ordenado_por_nombre():
    repo = RepoRolesMemoria(roles=[
        Rol(identificador=1, nombre='RECEPCIONISTA'),
        Rol(identificador=2, nombre='ANALISTA'),
    ])
    assert [r.nombre for r in listar_roles(repo)] == ['ANALISTA', 'RECEPCIONISTA']


def test_normaliza_nombre_a_mayusculas_sin_espacios_repetidos():
    assert normalizar_nombre_rol('  analista   junior ') == 'ANALISTA JUNIOR'


def test_crea_un_rol_nuevo():
    repo = RepoRolesMemoria()
    rol = crear_rol(repo, CrearRolDTO(nombre='analista', descripcion='Rol de analista'))
    assert rol.nombre == 'ANALISTA'
    assert repo.obtener_por_id(rol.identificador) is not None


def test_rechaza_nombre_vacio():
    repo = RepoRolesMemoria()
    with pytest.raises(ValidationError):
        crear_rol(repo, CrearRolDTO(nombre='   '))


def test_rechaza_nombre_duplicado_insensible_a_mayusculas():
    repo = RepoRolesMemoria(roles=[Rol(identificador=1, nombre='ADMINISTRADOR')])
    with pytest.raises(ConflictError):
        crear_rol(repo, CrearRolDTO(nombre='administrador'))


def test_actualiza_nombre_de_un_rol_existente():
    repo = RepoRolesMemoria(roles=[Rol(identificador=1, nombre='ANALISTA')])
    rol = actualizar_rol(repo, ActualizarRolDTO(id=1, nombre='analista senior'))
    assert rol.nombre == 'ANALISTA SENIOR'


def test_actualizar_rol_inexistente_falla():
    repo = RepoRolesMemoria()
    with pytest.raises(NotFoundError):
        actualizar_rol(repo, ActualizarRolDTO(id=999, nombre='X'))


def test_actualizar_a_nombre_ya_usado_por_otro_rol_falla():
    repo = RepoRolesMemoria(roles=[
        Rol(identificador=1, nombre='ANALISTA'),
        Rol(identificador=2, nombre='RECEPCIONISTA'),
    ])
    with pytest.raises(ConflictError):
        actualizar_rol(repo, ActualizarRolDTO(id=2, nombre='analista'))


def test_elimina_un_rol_sin_cuentas_asociadas():
    repo = RepoRolesMemoria(roles=[Rol(identificador=1, nombre='TEMPORAL')], cuentas_por_rol={1: 0})
    eliminar_rol(repo, 1)
    assert repo.obtener_por_id(1) is None


def test_no_elimina_un_rol_en_uso_devuelve_conflicto():
    repo = RepoRolesMemoria(roles=[Rol(identificador=1, nombre='ADMINISTRADOR')], cuentas_por_rol={1: 3})
    with pytest.raises(ConflictError):
        eliminar_rol(repo, 1)
    assert repo.obtener_por_id(1) is not None


def test_eliminar_rol_inexistente_falla():
    repo = RepoRolesMemoria()
    with pytest.raises(NotFoundError):
        eliminar_rol(repo, 999)
