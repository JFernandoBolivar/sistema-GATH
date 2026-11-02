"""
Tests de `listar_departamentos` con repositorio en memoria.
"""
from apps.identidad.application.use_cases.listar_departamentos import (
    listar_departamentos,
)
from apps.identidad.domain.entities.departamento import Departamento
from tests.unit.identidad.conftest import RepoDepartamentosMemoria


def test_lista_el_catalogo_completo():
    repo = RepoDepartamentosMemoria(departamentos=[
        Departamento(id=1, nombre='Talento Humano'),
        Departamento(id=2, nombre='Presupuesto'),
    ])

    resultado = listar_departamentos(repo)

    assert [d.nombre for d in resultado] == ['Talento Humano', 'Presupuesto']


def test_catalogo_vacio_devuelve_lista_vacia():
    assert listar_departamentos(RepoDepartamentosMemoria()) == []
