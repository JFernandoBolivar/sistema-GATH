"""
Tests del CRUD del catálogo de roles (cierra CRIT-12; O43) con repositorio en memoria.

El código interno (`nombre`) es fijo; el usuario solo escribe y edita el nombre visible.
"""
import pytest

from apps.identidad.application.dtos.rol_dto import ActualizarRolDTO, CrearRolDTO
from apps.identidad.application.use_cases.actualizar_rol import actualizar_rol
from apps.identidad.application.use_cases.crear_rol import (
    crear_rol,
    generar_codigo_rol,
    normalizar_nombre_visible,
)
from apps.identidad.application.use_cases.eliminar_rol import eliminar_rol
from apps.identidad.application.use_cases.listar_roles import listar_roles
from apps.identidad.domain.entities.rol import Rol
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from tests.unit.identidad.conftest import RepoRolesMemoria


def test_lista_el_catalogo_ordenado_por_codigo():
    repo = RepoRolesMemoria(roles=[
        Rol(identificador=1, nombre='RECEPCIONISTA'),
        Rol(identificador=2, nombre='ANALISTA'),
    ])
    assert [r.nombre for r in listar_roles(repo)] == ['ANALISTA', 'RECEPCIONISTA']


def test_etiqueta_usa_el_nombre_visible_y_cae_al_codigo_si_falta():
    assert Rol(identificador=1, nombre='ADMIN_BIENESTAR', nombre_visible='Administrador de Bienestar').etiqueta == (
        'Administrador de Bienestar'
    )
    assert Rol(identificador=2, nombre='AUDITOR').etiqueta == 'AUDITOR'
    assert Rol(identificador=3, nombre='AUDITOR', nombre_visible='   ').etiqueta == 'AUDITOR'


def test_normaliza_nombre_visible_sin_cambiar_mayusculas_ni_acentos():
    assert normalizar_nombre_visible('  Analista   de  Bienestar ') == 'Analista de Bienestar'
    assert normalizar_nombre_visible('Autogestión') == 'Autogestión'


@pytest.mark.parametrize('nombre, codigo', [
    ('Analista de Bienestar', 'ANALISTA_DE_BIENESTAR'),
    ('Autogestión', 'AUTOGESTION'),
    ('  Jefe   de  RRHH ', 'JEFE_DE_RRHH'),
    ('Coordinación Ñandú (Zona 2)', 'COORDINACION_NANDU_ZONA_2'),
])
def test_genera_codigo_sin_acentos_en_mayusculas_y_con_guion_bajo(nombre, codigo):
    assert generar_codigo_rol(nombre) == codigo


def test_crea_un_rol_nuevo_con_codigo_generado_y_nombre_visible():
    repo = RepoRolesMemoria()
    rol = crear_rol(repo, CrearRolDTO(nombre_visible='Analista Junior', descripcion='Rol de analista'))
    assert rol.nombre == 'ANALISTA_JUNIOR'
    assert rol.nombre_visible == 'Analista Junior'
    assert repo.obtener_por_id(rol.identificador) is not None


def test_codigo_generado_es_unico_aunque_otro_rol_ya_lo_use():
    repo = RepoRolesMemoria(roles=[Rol(identificador=1, nombre='ANALISTA_JUNIOR', nombre_visible='Otro')])
    rol = crear_rol(repo, CrearRolDTO(nombre_visible='Analista Junior'))
    assert rol.nombre == 'ANALISTA_JUNIOR_2'


def test_codigo_generado_respeta_el_largo_maximo():
    repo = RepoRolesMemoria()
    rol = crear_rol(repo, CrearRolDTO(nombre_visible='A' * 60))
    assert len(rol.nombre) <= 50


def test_rechaza_nombre_vacio_o_sin_letras():
    repo = RepoRolesMemoria()
    with pytest.raises(ValidationError):
        crear_rol(repo, CrearRolDTO(nombre_visible='   '))
    with pytest.raises(ValidationError):
        crear_rol(repo, CrearRolDTO(nombre_visible='---'))


def test_rechaza_nombre_visible_duplicado_insensible_a_mayusculas():
    repo = RepoRolesMemoria(roles=[
        Rol(identificador=1, nombre='ADMINISTRADOR', nombre_visible='Administrador'),
    ])
    with pytest.raises(ConflictError):
        crear_rol(repo, CrearRolDTO(nombre_visible='administrador'))


def test_actualiza_nombre_visible_sin_tocar_el_codigo():
    repo = RepoRolesMemoria(roles=[
        Rol(identificador=1, nombre='ANALISTA', nombre_visible='Analista'),
    ])
    rol = actualizar_rol(repo, ActualizarRolDTO(id=1, nombre_visible='  Analista   Senior '))
    assert rol.nombre == 'ANALISTA'
    assert rol.nombre_visible == 'Analista Senior'


def test_actualiza_solo_la_descripcion_conserva_el_nombre_visible():
    repo = RepoRolesMemoria(roles=[
        Rol(identificador=1, nombre='ANALISTA', nombre_visible='Analista'),
    ])
    rol = actualizar_rol(repo, ActualizarRolDTO(id=1, descripcion='Nueva descripción'))
    assert rol.nombre_visible == 'Analista'
    assert rol.descripcion == 'Nueva descripción'


def test_rechaza_cambiar_el_codigo_interno():
    repo = RepoRolesMemoria(roles=[
        Rol(identificador=1, nombre='ANALISTA', nombre_visible='Analista'),
    ])
    with pytest.raises(ValidationError):
        actualizar_rol(repo, ActualizarRolDTO(id=1, codigo='ANALISTA_SENIOR', nombre_visible='Analista Senior'))
    assert repo.obtener_por_id(1).nombre == 'ANALISTA'
    assert repo.obtener_por_id(1).nombre_visible == 'Analista'


def test_acepta_reenviar_el_mismo_codigo_sin_cambios():
    repo = RepoRolesMemoria(roles=[
        Rol(identificador=1, nombre='ANALISTA', nombre_visible='Analista'),
    ])
    rol = actualizar_rol(repo, ActualizarRolDTO(id=1, codigo='analista', nombre_visible='Analista 2'))
    assert rol.nombre == 'ANALISTA'
    assert rol.nombre_visible == 'Analista 2'


def test_actualizar_rol_inexistente_falla():
    repo = RepoRolesMemoria()
    with pytest.raises(NotFoundError):
        actualizar_rol(repo, ActualizarRolDTO(id=999, nombre_visible='X'))


def test_actualizar_a_nombre_visible_ya_usado_por_otro_rol_falla():
    repo = RepoRolesMemoria(roles=[
        Rol(identificador=1, nombre='ANALISTA', nombre_visible='Analista'),
        Rol(identificador=2, nombre='RECEPCIONISTA', nombre_visible='Recepcionista'),
    ])
    with pytest.raises(ConflictError):
        actualizar_rol(repo, ActualizarRolDTO(id=2, nombre_visible='analista'))


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
