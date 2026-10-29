"""Validación de archivos (Etapa A5): fotos JPG/PNG y soportes PDF, firma real y tamaño."""
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from core.domain.exceptions import ValidationError
from core.infrastructure.storage.validacion_archivo import (
    MAX_BYTES_FOTO,
    MAX_BYTES_SOPORTE,
    TIPOS_FOTO,
    TIPOS_SOPORTE,
    clave_segura,
    validar_archivo,
)

JPEG = b'\xff\xd8\xff\xe0' + b'0' * 64
PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 64
PDF = b'%PDF-1.7\n' + b'0' * 64


def _f(nombre, contenido):
    return SimpleUploadedFile(nombre, contenido, content_type='application/octet-stream')


@pytest.mark.parametrize('nombre,contenido,mime', [
    ('selfie.jpg', JPEG, 'image/jpeg'),
    ('selfie.PNG', PNG, 'image/png'),
])
def test_foto_valida_jpg_y_png(nombre, contenido, mime):
    datos, tipo, _ext = validar_archivo(_f(nombre, contenido), TIPOS_FOTO, MAX_BYTES_FOTO)
    assert datos == contenido and tipo.mime == mime


def test_foto_no_acepta_pdf_ni_webp():
    with pytest.raises(ValidationError):
        validar_archivo(_f('a.pdf', PDF), TIPOS_FOTO, MAX_BYTES_FOTO)
    with pytest.raises(ValidationError):
        validar_archivo(_f('a.webp', b'RIFF' + b'0' * 4 + b'WEBP'), TIPOS_FOTO, MAX_BYTES_FOTO)


@pytest.mark.parametrize('nombre,contenido', [('titulo.pdf', PDF), ('acta.jpeg', JPEG), ('acta.png', PNG)])
def test_soporte_acepta_pdf_e_imagenes(nombre, contenido):
    datos, _tipo, _ext = validar_archivo(_f(nombre, contenido), TIPOS_SOPORTE, MAX_BYTES_SOPORTE)
    assert datos == contenido


def test_firma_falsa_se_rechaza():
    with pytest.raises(ValidationError, match='no corresponde'):
        validar_archivo(_f('titulo.pdf', JPEG), TIPOS_SOPORTE, MAX_BYTES_SOPORTE)
    with pytest.raises(ValidationError, match='no corresponde'):
        validar_archivo(_f('selfie.jpg', b'<script>alert(1)</script>'), TIPOS_FOTO, MAX_BYTES_FOTO)


def test_tamano_excedido_en_foto_y_soporte():
    with pytest.raises(ValidationError, match='tamaño'):
        validar_archivo(_f('s.jpg', JPEG + b'0' * MAX_BYTES_FOTO), TIPOS_FOTO, MAX_BYTES_FOTO)
    with pytest.raises(ValidationError, match='tamaño'):
        validar_archivo(_f('t.pdf', PDF + b'0' * MAX_BYTES_SOPORTE), TIPOS_SOPORTE, MAX_BYTES_SOPORTE)


def test_extension_ejecutable_se_rechaza_y_la_clave_no_usa_el_nombre_del_cliente():
    with pytest.raises(ValidationError):
        validar_archivo(_f('x.php', JPEG), TIPOS_SOPORTE, MAX_BYTES_SOPORTE)
    clave = clave_segura('fe_de_vida/1', '.jpg')
    assert clave.startswith('fe_de_vida/1/') and clave.endswith('.jpg') and '..' not in clave


def test_las_vistas_de_subida_usan_la_utilidad_de_infraestructura():
    raiz = Path(__file__).resolve().parents[3]
    vistas = [
        'apps/familiares/presentation/views/familiares_views.py',
        'apps/carnetizacion/presentation/views/carnetizacion_views.py',
        'apps/personal/presentation/views/personal_views.py',
        'apps/configuracion/presentation/views/configuracion_visual_views.py',
    ]
    for vista in vistas:
        texto = (raiz / vista).read_text(encoding='utf8')
        assert 'core.infrastructure.storage.validacion_archivo' in texto and 'validar_archivo(' in texto, vista
