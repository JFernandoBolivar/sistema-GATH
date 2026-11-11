"""Código QR corto de 22 caracteres base64url, compatible con el SHA-256 hex anterior."""
import re

import pytest

from apps.carnetizacion.domain.value_objects.security_hash import (
    SecurityHashCarnet,
    generar_codigo_qr,
    normalizar_codigo_qr,
)
from core.domain.exceptions import ValidationError


def test_generar_22_caracteres_base64url_y_unicos():
    codigos = {generar_codigo_qr() for _ in range(500)}
    assert len(codigos) == 500
    assert all(re.fullmatch(r'[A-Za-z0-9_-]{22}', c) for c in codigos)


def test_normalizar_acepta_ambos_formatos():
    corto = 'AbCdEfGhIjKlMnOpQrSt-_'
    assert normalizar_codigo_qr(corto) == corto
    assert normalizar_codigo_qr(f' {corto} ') == corto
    assert normalizar_codigo_qr('A' * 64) == 'a' * 64
    assert normalizar_codigo_qr('f' * 64) == 'f' * 64


@pytest.mark.parametrize('valor', [None, '', 'corto', 'a' * 23, 'g' * 64, 'a' * 22 + '=', "' OR 1=1 --"])
def test_normalizar_rechaza_invalidos(valor):
    assert normalizar_codigo_qr(valor) is None


def test_value_object_ambos_formatos():
    assert str(SecurityHashCarnet('a' * 64)) == 'a' * 64
    assert str(SecurityHashCarnet(generar_codigo_qr()))
    with pytest.raises(ValidationError):
        SecurityHashCarnet('xyz')


@pytest.mark.django_db
def test_codigo_qr_unico_de_22_caracteres():
    from apps.carnetizacion.infrastructure.codigo_qr import codigo_qr_unico

    a, b = codigo_qr_unico(), codigo_qr_unico()
    assert len(a) == 22 and a != b
