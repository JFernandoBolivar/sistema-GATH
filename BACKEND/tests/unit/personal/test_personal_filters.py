"""
Filtros del listado de personal por estructura organizativa (Fase 2).
Puros: el parser de query params y el paso de criterios por el caso de uso.
"""
import pytest

from apps.personal.application.use_cases.listar_personal import listar_personal
from apps.personal.presentation.filters.personal_filters import FILTROS_ESTRUCTURA, filtros_listado_personal
from core.domain.exceptions import ValidationError


def test_sin_query_params_no_filtra_nada():
    filtros = filtros_listado_personal({})
    assert all(v is None for v in filtros.values())


def test_parsea_ids_de_estructura_y_texto_libre():
    filtros = filtros_listado_personal({
        'busqueda': 'perez', 'tipo_nomina': '3',
        'dependencia_id': '2', 'direccion_general_id': '10',
        'direccion_linea_id': '', 'coordinacion_id': '7',
    })
    assert filtros['busqueda'] == 'perez'
    assert filtros['tipo_nomina'] == '3'
    assert filtros['dependencia_id'] == 2
    assert filtros['direccion_general_id'] == 10
    assert filtros['direccion_linea_id'] is None
    assert filtros['coordinacion_id'] == 7


def test_q_tiene_prioridad_sobre_busqueda():
    assert filtros_listado_personal({'q': 'a', 'busqueda': 'b'})['busqueda'] == 'a'


@pytest.mark.parametrize('nombre', FILTROS_ESTRUCTURA)
def test_id_no_numerico_es_error_explicito(nombre):
    with pytest.raises(ValidationError, match=nombre):
        filtros_listado_personal({nombre: 'abc'})


def test_caso_de_uso_pasa_los_criterios_de_estructura_al_repositorio():
    class _Repo:
        def listar_empleados(self, **kwargs):
            self.recibido = kwargs
            return []

    repo = _Repo()
    listar_personal(repo, **filtros_listado_personal({'dependencia_id': '2', 'coordinacion_id': '5'}))
    assert repo.recibido['dependencia_id'] == 2
    assert repo.recibido['coordinacion_id'] == 5
    assert repo.recibido['direccion_general_id'] is None
