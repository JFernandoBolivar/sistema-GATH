"""Estilo configurable del QR del carnet: presets, validación al publicar, PDF y logo de la biblioteca."""
import io

import pytest
from PIL import Image

from apps.carnetizacion.application.use_cases.gestionar_plantillas import (
    crear_plantilla_borrador,
    publicar_plantilla,
)
from apps.carnetizacion.domain.services.qr_estilo import (
    contraste_wcag,
    normalizar_estilo,
    validar_estilos_qr,
)
from apps.carnetizacion.infrastructure.pdf import carnet_pdf
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import DatosCarnetPdf, generar_carnet_pdf
from apps.carnetizacion.infrastructure.qr_institucional import generar_qr_png
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from core.domain.exceptions import ValidationError

CONTENIDO = 'https://gath.conatel.gob.ve/carnet/AbCdEfGhIjKlMnOpQrStUv'
PRESETS = [None, {'preset': 'institucional'}, {'preset': 'degradado'}, {'preset': 'clasico'}]


class _Lector:
    def obtener_entero(self, clave: str) -> int:
        return 10


def _imagen(png: bytes) -> Image.Image:
    assert png.startswith(b'\x89PNG')
    return Image.open(io.BytesIO(png)).convert('RGB')


def _qr(estilo=None, lado=22):
    props = {'qr_estilo': estilo} if estilo is not None else {}
    return {'id': 'qr', 'tipo': 'qr', 'x': 1, 'y': 1, 'w': lado, 'h': lado, 'props': props}


@pytest.mark.parametrize('estilo', PRESETS)
def test_cada_preset_genera_png_con_alto_contraste_y_se_decodifica(estilo):
    img = _imagen(generar_qr_png(CONTENIDO, box_size=8, border=2, estilo=estilo))
    assert img.width == img.height
    # Contraste: la zona de silencio es blanca y la tinta más oscura contrasta >= 4,5 con ella.
    assert img.getpixel((2, 2)) == (255, 255, 255)
    oscuro = min(img.getdata(), key=sum)
    assert contraste_wcag('#%02x%02x%02x' % oscuro) >= 4.5
    try:
        import cv2
        import numpy as np
    except ImportError:
        # Sin OpenCV: el logo no puede pasar del 25 % del ancho (el estilo lo limita a 24 %).
        assert normalizar_estilo(estilo)['logo']['tamano_pct'] <= 25
        return
    leido, _, _ = cv2.QRCodeDetector().detectAndDecode(np.array(img)[:, :, ::-1].copy())
    assert leido == CONTENIDO


def test_sin_estilo_equivale_a_institucional():
    assert normalizar_estilo(None)['preset'] == 'institucional'
    assert generar_qr_png(CONTENIDO) == generar_qr_png(CONTENIDO, estilo={'preset': 'institucional'})
    assert generar_qr_png(CONTENIDO) != generar_qr_png(CONTENIDO, estilo={'preset': 'clasico'})


def test_el_tamano_del_logo_se_limita_a_15_24():
    assert normalizar_estilo({'logo': {'tamano_pct': 60}})['logo']['tamano_pct'] == 24
    assert normalizar_estilo({'logo': {'tamano_pct': 2}})['logo']['tamano_pct'] == 15


def test_sin_logo_el_png_cambia():
    con = generar_qr_png(CONTENIDO, estilo={'logo': {'activo': True}})
    sin = generar_qr_png(CONTENIDO, estilo={'logo': {'activo': False}})
    assert con != sin


def test_estilo_personalizado_con_poco_contraste_se_rechaza():
    definicion = {'anverso': [_qr({'preset': 'personalizado', 'color_modulos': '#AAAAAA'})], 'reverso': []}
    with pytest.raises(ValidationError) as exc:
        validar_estilos_qr(definicion)
    assert 'contraste' in str(exc.value) and '4.5' in str(exc.value)


@pytest.mark.parametrize('estilo,fragmento', [
    ({'preset': 'personalizado', 'color_modulos': '#1B2A4A', 'color_modulos_2': '#FFEE00'}, 'degradado'),
    ({'preset': 'personalizado', 'color_ojo_marco': '#FFCC00'}, 'marco de los ojos'),
    ({'preset': 'personalizado', 'logo': {'activo': True, 'tamano_pct': 30}}, '24 %'),
])
def test_otras_reglas_de_legibilidad(estilo, fragmento):
    with pytest.raises(ValidationError) as exc:
        validar_estilos_qr({'anverso': [], 'reverso': [_qr(estilo)]})
    assert fragmento in str(exc.value)


def test_presets_y_estilos_validos_pasan():
    for estilo in PRESETS + [{'preset': 'personalizado', 'forma_modulos': 'puntos', 'color_modulos': '#222222'}]:
        validar_estilos_qr({'anverso': [_qr(estilo)], 'reverso': []})


@pytest.mark.django_db
def test_publicar_rechaza_estilo_ilegible_y_acepta_uno_bueno():
    repo = RepoCarnetizacionORM()
    malo = crear_plantilla_borrador(
        repo, nombre='QR claro', codigo_tipo='trabajador',
        definicion={'anverso': [_qr({'preset': 'personalizado', 'color_modulos': '#BBBBBB'})], 'reverso': []},
    )
    with pytest.raises(ValidationError) as exc:
        publicar_plantilla(repo, malo.id, lector=_Lector())
    assert 'no es legible' in str(exc.value)
    bueno = crear_plantilla_borrador(
        repo, nombre='QR bueno', codigo_tipo='trabajador',
        definicion={'anverso': [_qr({'preset': 'degradado'})], 'reverso': []},
    )
    assert publicar_plantilla(repo, bueno.id, lector=_Lector()).estado == 'publicada'


def _definicion(estilo):
    return {'ancho_mm': 54, 'alto_mm': 85.6, 'bg': {}, 'anverso': [_qr(estilo, lado=22)], 'reverso': []}


def _datos():
    return DatosCarnetPdf(
        nombre_completo='Ana Gómez', cedula='1', cargo='X', departamento='Y', security_hash='hash-estilo-qr',
    )


class _CacheFalsa:
    def __init__(self, memoriza=False):
        self.datos: dict = {}
        self.memoriza = memoriza

    def get(self, clave, *_a):
        return self.datos.get(clave) if self.memoriza else None

    def set(self, clave, valor, *_a):
        self.datos[clave] = valor


def _sin_cache(monkeypatch, memoriza=False):
    falsa = _CacheFalsa(memoriza)
    monkeypatch.setattr(carnet_pdf, 'cache', falsa)
    return falsa


def test_el_pdf_usa_el_estilo_del_elemento(monkeypatch):
    llamadas = []
    real = carnet_pdf.generar_qr_png

    def espia(contenido, **kw):
        llamadas.append(kw)
        return real(contenido, **kw)

    monkeypatch.setattr(carnet_pdf, 'generar_qr_png', espia)
    _sin_cache(monkeypatch)
    assert generar_carnet_pdf(_datos(), _definicion({'preset': 'degradado'})).startswith(b'%PDF')
    assert llamadas[-1]['estilo']['preset'] == 'degradado'
    generar_carnet_pdf(_datos(), _definicion(None))
    assert llamadas[-1]['estilo']['preset'] == 'institucional'


def test_la_cache_distingue_los_estilos(monkeypatch):
    guardado = _sin_cache(monkeypatch, memoriza=True).datos
    a = carnet_pdf._qr_png_cacheado(CONTENIDO, True, {'preset': 'degradado'})
    b = carnet_pdf._qr_png_cacheado(CONTENIDO, True, {'preset': 'clasico'})
    assert a != b and len(guardado) == 2


def test_el_logo_de_la_biblioteca_se_usa_cuando_hay_medio_id(monkeypatch):
    rojo = io.BytesIO()
    Image.new('RGBA', (200, 100), (255, 0, 0, 255)).save(rojo, format='PNG')
    pedidos = []
    _sin_cache(monkeypatch)

    class _Repo:
        def obtener_archivo_biblioteca(self, medio_id):
            pedidos.append(medio_id)
            return rojo.getvalue(), 'image/png', 'rojo.png'

    monkeypatch.setattr(
        'apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm.RepoCarnetizacionORM', _Repo,
    )
    estilo = {'preset': 'institucional', 'logo': {'activo': True, 'medio_id': 'abc-123', 'tamano_pct': 20}}
    img = _imagen(carnet_pdf._qr_png_cacheado(CONTENIDO, True, estilo))
    assert pedidos == ['abc-123']
    centro = img.getpixel((img.width // 2, img.height // 2))
    assert centro[0] > 200 and centro[1] < 60  # logo rojo de la biblioteca, no el de CONATEL
    pedidos.clear()
    carnet_pdf._qr_png_cacheado(CONTENIDO, True, {'preset': 'institucional'})
    assert pedidos == []
