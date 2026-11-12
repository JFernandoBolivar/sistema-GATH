"""QR legible con teléfono (SILOG): regla pura de publicación de plantillas."""
import pytest

from apps.carnetizacion.domain.services.qr_legible import (
    qr_mas_grande,
    validar_qr_legible,
)
from core.domain.exceptions import ValidationError

MINIMO = 20


def _qr(w=20, h=20, tipo='qr'):
    return {'tipo': tipo, 'w': w, 'h': h}


def test_sin_qr_falla_con_la_medida_cero():
    definicion = {'anverso': [_qr(tipo='texto', w=40, h=6)], 'reverso': []}

    with pytest.raises(ValidationError) as error:
        validar_qr_legible(definicion, MINIMO)

    assert '0 × 0' in str(error.value)
    assert 'SILOG' in str(error.value)


def test_qr_pequeno_falla_y_muestra_su_medida():
    with pytest.raises(ValidationError) as error:
        validar_qr_legible({'anverso': [_qr(w=15, h=12)]}, MINIMO)

    assert '15 × 12' in str(error.value)


def test_qr_exactamente_en_el_minimo_pasa():
    validar_qr_legible({'anverso': [_qr(w=MINIMO, h=MINIMO)]}, MINIMO)


def test_el_reverso_cuenta_y_se_elige_el_mayor():
    definicion = {
        'anverso': [_qr(w=25, h=10)],
        'reverso': [_qr(w=21, h=22)],
    }

    assert qr_mas_grande(definicion) == (21.0, 22.0)
    validar_qr_legible(definicion, MINIMO)


def test_valores_invalidos_o_negativos_cuentan_como_cero():
    definicion = {'anverso': [_qr(w='grande', h=-5)]}

    assert qr_mas_grande(definicion) == (0.0, 0.0)
    with pytest.raises(ValidationError):
        validar_qr_legible(definicion, MINIMO)


def test_definicion_vacia_o_none_no_rompe():
    assert qr_mas_grande(None) is None
    assert qr_mas_grande({}) is None
    with pytest.raises(ValidationError):
        validar_qr_legible(None, MINIMO)
