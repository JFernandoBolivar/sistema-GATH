"""Dominio del RIF y de los idiomas del trabajador (F-8). Sin BD."""
import pytest

from apps.personal.domain.value_objects.idiomas import normalizar_idiomas
from apps.personal.domain.value_objects.rif import normalizar_rif
from core.domain.exceptions import ValidationError


@pytest.mark.parametrize('entrada, esperado', [
    ('V-12345678-9', 'V-12345678-9'), ('v-12345678-9', 'V-12345678-9'), ('V123456789', 'V-12345678-9'),
    (' e 12345678 0 ', 'E-12345678-0'), ('J-301234567', 'J-30123456-7'), ('P-1234567-1', 'P-01234567-1'),
    ('G-20000001-2', 'G-20000001-2'), ('', ''), ('   ', ''), (None, ''),
])
def test_normaliza_el_rif(entrada, esperado):
    assert normalizar_rif(entrada) == esperado


@pytest.mark.parametrize('entrada', ['12345678-9', 'X-12345678-9', 'V-123-9', 'V-1234567890-1', 'V-ABCD1234-5', 'V--', 7, ['V']])
def test_rechaza_el_rif_mal_formado(entrada):
    with pytest.raises(ValidationError) as e:
        normalizar_rif(entrada)
    assert e.value.campo == 'rif'


def test_normaliza_los_idiomas():
    assert normalizar_idiomas([
        {'idioma_id': '2', 'nivel': ' bien '}, {'otro_idioma': '  Lengua   guaraní ', 'nivel': 'Poco'},
        {'idioma_id': None, 'otro_idioma': 'Latín', 'nivel': 'REGULAR'},
    ]) == [
        {'idioma_id': 2, 'otro_idioma': '', 'nivel': 'BIEN'}, {'idioma_id': None, 'otro_idioma': 'Lengua guaraní', 'nivel': 'POCO'},
        {'idioma_id': None, 'otro_idioma': 'Latín', 'nivel': 'REGULAR'},
    ]
    assert normalizar_idiomas([]) == []


@pytest.mark.parametrize('lista, campo', [
    ('x', 'idiomas'), ([{}] * 16, 'idiomas'), (['x'], 'idiomas.0'), ([{'raro': 1, 'nivel': 'BIEN'}], 'idiomas.0'),
    ([{'nivel': 'BIEN'}], 'idiomas.0.otro_idioma'),                                   # ni catálogo ni nombre
    ([{'idioma_id': 1, 'otro_idioma': 'X', 'nivel': 'BIEN'}], 'idiomas.0.idioma_id'),  # ambos
    ([{'idioma_id': 0, 'nivel': 'BIEN'}], 'idiomas.0.idioma_id'), ([{'idioma_id': True, 'nivel': 'BIEN'}], 'idiomas.0.idioma_id'),
    ([{'idioma_id': 1}], 'idiomas.0.nivel'), ([{'idioma_id': 1, 'nivel': 'ALTO'}], 'idiomas.0.nivel'),
    ([{'otro_idioma': 'x' * 61, 'nivel': 'BIEN'}], 'idiomas.0.otro_idioma'), ([{'otro_idioma': 5, 'nivel': 'BIEN'}], 'idiomas.0.otro_idioma'),
    ([{'idioma_id': 1, 'nivel': 'BIEN'}, {'idioma_id': 1, 'nivel': 'POCO'}], 'idiomas.1'),
    ([{'otro_idioma': 'Latín', 'nivel': 'BIEN'}, {'otro_idioma': 'LATÍN', 'nivel': 'POCO'}], 'idiomas.1'),
])
def test_rechaza_idiomas_invalidos_con_la_ruta(lista, campo):
    with pytest.raises(ValidationError) as e:
        normalizar_idiomas(lista)
    assert e.value.campo == campo
