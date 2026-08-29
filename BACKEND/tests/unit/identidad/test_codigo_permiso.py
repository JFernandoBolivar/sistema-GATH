"""
Tests del Value Object `CodigoPermiso` y entidades de identidad (B3.1, B5).
"""
import pytest

from core.domain.exceptions import ValidationError

from apps.identidad.domain.value_objects.codigo_permiso import CodigoPermiso


@pytest.mark.parametrize('codigo', [
    'personal.crear',
    'identidad.listar_permisos',
    'carnetizacion.emitir',
    'a.b',
])
def test_acepta_codigos_validos(codigo):
    vo = CodigoPermiso(codigo)

    assert vo.valor == codigo


@pytest.mark.parametrize('codigo', [
    'personalcrear',        # sin punto
    'Personal.Crear',       # mayúsculas
    'personal.',            # acción vacía
    '.crear',               # módulo vacío
    'personal.crear.extra', # tres segmentos
    'personal crear',       # espacio en vez de punto
    '',                     # vacío
])
def test_rechaza_codigos_invalidos(codigo):
    with pytest.raises(ValidationError):
        CodigoPermiso(codigo)


def test_descompone_modulo_y_accion():
    vo = CodigoPermiso('personal.ver_salud')

    assert vo.modulo == 'personal'
    assert vo.accion == 'ver_salud'
