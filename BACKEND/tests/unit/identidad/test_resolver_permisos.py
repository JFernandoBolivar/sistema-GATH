"""
Tests de `resolver_permisos` (B3.2) con repositorio en memoria — sin Django.
"""
from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.resolver_permisos import (
    resolver_permisos,
    tiene_permiso,
)


def test_rol_con_n_permisos_devuelve_todos_los_codigos(repo_con_matriz):
    actor = ActorSesionDTO(cuenta_id=1, rol_id=7)

    codigos = resolver_permisos(repo_con_matriz, actor)

    assert codigos == frozenset(
        {'personal.crear', 'personal.ver_salud', 'identidad.listar_permisos'}
    )


def test_cuenta_sin_rol_no_obtiene_ningun_permiso(repo_con_matriz):
    actor = ActorSesionDTO(cuenta_id=2, rol_id=None)

    codigos = resolver_permisos(repo_con_matriz, actor)

    assert codigos == frozenset()


def test_actor_con_rol_sin_matriz_cargada_no_obtiene_permisos(repo_con_matriz):
    actor = ActorSesionDTO(cuenta_id=3, rol_id=8)

    assert resolver_permisos(repo_con_matriz, actor) == frozenset()


def test_tiene_permiso_concede_un_codigo_de_la_matriz(repo_con_matriz):
    actor = ActorSesionDTO(cuenta_id=1, rol_id=7)

    assert tiene_permiso(repo_con_matriz, actor, 'personal.crear') is True


def test_codigo_inexistente_en_la_matriz_deniega(repo_con_matriz):
    actor = ActorSesionDTO(cuenta_id=1, rol_id=7)

    # El permiso existe en el catálogo pero el rol no lo tiene asignado...
    assert (
        tiene_permiso(repo_con_matriz, actor, 'carnetizacion.emitir') is False
    )
    # ...y un código que ni siquiera está dado de alta también deniega.
    assert tiene_permiso(repo_con_matriz, actor, 'modulo.inventado') is False


def test_codigo_inexistente_para_cuenta_sin_rol_deniega(repo_con_matriz):
    actor = ActorSesionDTO(cuenta_id=2, rol_id=None)

    assert (
        tiene_permiso(repo_con_matriz, actor, 'identidad.listar_permisos')
        is False
    )
