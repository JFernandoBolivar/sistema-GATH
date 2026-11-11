"""S2-10: la imagen de evidencia se rechaza por su tamaño declarado antes de decodificar píxeles."""
from io import BytesIO
from unittest.mock import patch

import pytest
from PIL import Image

from apps.fe_de_vida.infrastructure.imagen_evidencia import sanear_imagen
from core.domain.exceptions import ValidationError


def _png(ancho, alto):
    salida = BytesIO()
    Image.new('L', (ancho, alto)).save(salida, format='PNG')
    return salida.getvalue()


def test_imagen_sobre_el_limite_de_pixeles_se_rechaza_sin_decodificar(settings):
    settings.IMAGEN_MAX_PIXELES = 1_000_000
    contenido = _png(2000, 2000)  # 4 MP declarados, pesa pocos KB
    with patch.object(Image.Image, 'load', side_effect=AssertionError('no debe decodificar')):
        with pytest.raises(ValidationError) as exc:
            sanear_imagen(contenido, 'image/png')
    assert 'demasiado grande' in str(exc.value)


def test_imagen_dentro_del_limite_se_procesa(settings):
    settings.IMAGEN_MAX_PIXELES = 1_000_000
    assert sanear_imagen(_png(600, 600), 'image/png')[:4] == b'\x89PNG'
