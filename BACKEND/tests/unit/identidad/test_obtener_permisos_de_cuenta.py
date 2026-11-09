"""
Tests de `obtener_permisos_de_cuenta` (B3.1) con repositorio en memoria.
"""
from apps.identidad.application.use_cases.obtener_permisos_de_cuenta import (
    obtener_permisos_de_cuenta,
)


def test_resuelve_codigos_efectivos_de_un_rol_con_n_permisos(
    repo_con_matriz,
):
    dto = obtener_permisos_de_cuenta(repo_con_matriz, 'V-12345678')

    assert dto.cedula == 'V-12345678'
    assert dto.rol_id == 7
    assert dto.codigos == frozenset(
        {'personal.crear', 'personal.ver_salud', 'identidad.listar_permisos'}
    )
    assert len(dto.codigos) == 3


def test_cuenta_sin_rol_devuelve_conjunto_vacio(repo_con_matriz):
    # La cédula no está registrada: sin rol, sin permisos (fallo cerrado).
    dto = obtener_permisos_de_cuenta(repo_con_matriz, 'V-99999999')

    assert dto.rol_id is None
    assert dto.codigos == frozenset()
    assert dto.tiene('personal.crear') is False


def test_consulta_de_codigo_inexistente_deniega(repo_con_matriz):
    dto = obtener_permisos_de_cuenta(repo_con_matriz, 'V-12345678')

    assert dto.tiene('modulo.inventado') is False
