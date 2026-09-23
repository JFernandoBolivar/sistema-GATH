"""
Tests unitarios (sin BD) de los filtros en cascada de catálogos del
expediente: Nivel Académico -> Carrera -> Mención y Estado -> Código Postal.
Se reemplaza el repositorio ORM por un doble para verificar que la vista
traduce el query param al filtro del repositorio.
"""
from types import SimpleNamespace

import pytest
from rest_framework.test import APIRequestFactory

from apps.personal.presentation.views import catalogos_soporte_views as vistas


class RepoPersonalDoble:
    llamadas: dict = {}

    def listar_carreras(self, nivel_academico_id=None):
        RepoPersonalDoble.llamadas['carreras'] = nivel_academico_id
        carreras = [
            SimpleNamespace(pk=1, nombre_carrera='Ingeniería', nivel_academico_id_id=3),
            SimpleNamespace(pk=2, nombre_carrera='Bachiller', nivel_academico_id_id=1),
        ]
        if nivel_academico_id is None:
            return carreras
        return [c for c in carreras if c.nivel_academico_id_id == nivel_academico_id]


@pytest.fixture
def repo_doble(monkeypatch):
    RepoPersonalDoble.llamadas = {}
    monkeypatch.setattr(vistas, 'RepoPersonalORM', RepoPersonalDoble)
    return RepoPersonalDoble


def _get(view_cls, url):
    request = APIRequestFactory().get(url)
    view = view_cls()
    return view.get(view.initialize_request(request))


def test_carreras_filtra_por_nivel_academico(repo_doble):
    response = _get(vistas.CarrerasListView, '/api/v1/personal/catalogos/carreras/?nivel_academico_id=3')

    assert repo_doble.llamadas['carreras'] == 3
    assert [c['nombre'] for c in response.data['data']] == ['Ingeniería']


@pytest.mark.parametrize('valor', ['', 'abc', '0', '-2'])
def test_carreras_ignora_filtro_invalido(repo_doble, valor):
    response = _get(vistas.CarrerasListView, f'/api/v1/personal/catalogos/carreras/?nivel_academico_id={valor}')

    assert repo_doble.llamadas['carreras'] is None
    assert len(response.data['data']) == 2
