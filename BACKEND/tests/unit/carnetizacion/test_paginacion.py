"""Paginación de plantillas, fondos fijos y biblioteca: valores, límites y sobre de respuesta."""
import pytest

from apps.carnetizacion.domain.value_objects.paginacion import Paginacion
from core.domain.exceptions import ValidationError


def test_por_defecto_pagina_uno_de_doce():
    p = Paginacion.desde_parametros({})
    assert (p.pagina, p.tamano, p.offset) == (1, 12, 0)


@pytest.mark.parametrize('pedido,esperado', [('12', 12), ('24', 24), ('48', 48), ('5', 12), ('13', 24), ('500', 48)])
def test_tamanos_permitidos_y_tope(pedido, esperado):
    assert Paginacion.desde_parametros({'page_size': pedido}).tamano == esperado


def test_offset_y_total_paginas():
    p = Paginacion.desde_parametros({'pagina': '3', 'page_size': '24'})
    assert p.offset == 48
    assert p.total_paginas(0) == 1
    assert p.total_paginas(49) == 3


@pytest.mark.parametrize('params', [{'pagina': '0'}, {'pagina': 'x'}, {'page_size': '0'}, {'page_size': 'abc'}])
def test_parametros_invalidos_se_rechazan(params):
    with pytest.raises(ValidationError):
        Paginacion.desde_parametros(params)


def test_solicitada_solo_si_envia_pagina():
    assert Paginacion.solicitada({'pagina': '1'})
    assert not Paginacion.solicitada({'categoria': 'logo'})


def test_sobre_tiene_las_cinco_claves():
    sobre = Paginacion(pagina=2, tamano=12).sobre(['a'], 13)
    assert sobre == {'resultados': ['a'], 'total': 13, 'pagina': 2, 'tamano': 12, 'total_paginas': 2}
