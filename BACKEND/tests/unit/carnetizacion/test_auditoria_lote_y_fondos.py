"""Regresiones de la auditoría del carnet: lote dúplex (K-1), fondos (K-4, K-5, K-6, H-11, H-13)."""
from io import BytesIO

import pytest
from PIL import Image
from reportlab.pdfgen import canvas

from apps.carnetizacion.infrastructure.pdf import carnet_pdf, carnet_pdf_lote, rasterizar_pdf
from apps.carnetizacion.infrastructure.pdf.carnet_pdf_lote import generar_pdf_lote
from core.domain.exceptions import ValidationError

DATOS = {'nombre_completo': 'ANA', 'cedula': '1', 'cargo': 'X', 'departamento': 'Y', 'nomina': 'Z',
         'security_hash': 'h'}


def _definicion(ancho=54, alto=85.6, caras=None):
    d = {'dimensiones': {'ancho_mm': ancho, 'alto_mm': alto}, 'anverso': [], 'reverso': []}
    if caras:
        d['caras'] = caras
    return d


def _orden_de_caras(monkeypatch, tarjetas, **kwargs):
    """[(pagina, cara, cedula)] en el orden en que se dibujan."""
    eventos, pagina = [], [1]

    def espia(c, definicion, datos, cara, x, y, *a, **k):
        eventos.append((pagina[0], cara, datos['cedula']))

    original_show = canvas.Canvas.showPage

    def show(self):
        pagina[0] += 1
        return original_show(self)

    monkeypatch.setattr(carnet_pdf_lote, 'dibujar_cara', espia)
    monkeypatch.setattr(canvas.Canvas, 'showPage', show)
    generar_pdf_lote(tarjetas, **kwargs)
    return eventos


def test_k1_las_paginas_del_lote_van_intercaladas_por_hoja(monkeypatch):
    tarjetas = [{'definicion': _definicion(), 'datos': {**DATOS, 'cedula': str(i)}} for i in range(12)]
    eventos = _orden_de_caras(monkeypatch, tarjetas)

    paginas = {}
    for pag, cara, ced in eventos:
        paginas.setdefault(pag, set()).add((cara, ced))
    # Hoja 1: anversos 0-8, luego sus reversos; hoja 2: anversos 9-11, luego sus reversos.
    assert paginas[1] == {('anverso', str(i)) for i in range(9)}
    assert paginas[2] == {('reverso', str(i)) for i in range(9)}
    assert paginas[3] == {('anverso', str(i)) for i in range(9, 12)}
    assert paginas[4] == {('reverso', str(i)) for i in range(9, 12)}


def test_k12_legacy_de_una_cara_no_agrega_pagina_de_reversos(monkeypatch):
    tarjetas = [{'definicion': _definicion(caras=['anverso']), 'datos': DATOS} for _ in range(3)]
    eventos = _orden_de_caras(monkeypatch, tarjetas)
    assert {cara for _, cara, _ in eventos} == {'anverso'}
    assert {pag for pag, _, _ in eventos} == {1}


def test_k12_el_lote_rechaza_tamanos_mezclados_o_que_no_caben():
    with pytest.raises(ValueError, match='distinto tamaño'):
        generar_pdf_lote([
            {'definicion': _definicion(), 'datos': DATOS},
            {'definicion': _definicion(85.6, 54), 'datos': DATOS},
        ])
    with pytest.raises(ValueError, match='no cabe'):
        generar_pdf_lote([{'definicion': _definicion(85.6, 54), 'datos': DATOS}])


def _pdf(paginas):
    b = BytesIO()
    c = canvas.Canvas(b)
    for ancho, alto in paginas:
        c.setPageSize((ancho, alto))
        c.drawString(10, 10, 'x')
        c.showPage()
    c.save()
    return b.getvalue()


def test_k4_rechaza_paginas_enormes_y_demasiadas_paginas():
    with pytest.raises(ValidationError, match='demasiado grande'):
        rasterizar_pdf.rasterizar_pagina_pdf(_pdf([(14400, 14400)]))
    with pytest.raises(ValidationError, match='páginas'):
        rasterizar_pdf.rasterizar_pagina_pdf(_pdf([(200, 200)] * (rasterizar_pdf.MAX_PAGINAS_PDF + 1)))


def test_h13_se_rasteriza_la_pagina_elegida_y_se_valida_el_rango():
    pdf = _pdf([(200, 300), (600, 300)])
    with Image.open(BytesIO(rasterizar_pdf.rasterizar_pagina_pdf(pdf, 2))) as img:
        assert img.width > img.height  # la página 2 es apaisada
    with pytest.raises(ValidationError, match='elija una entre 1 y 2'):
        rasterizar_pdf.rasterizar_pagina_pdf(pdf, 3)


def _png(ancho, alto, color=(255, 0, 0)):
    b = BytesIO()
    Image.new('RGB', (ancho, alto), color).save(b, 'PNG')
    return b.getvalue()


def test_k5_un_fondo_de_demasiados_pixeles_no_se_decodifica(monkeypatch):
    carnet_pdf._bytes_fondo_cover.cache_clear()
    monkeypatch.setattr(carnet_pdf, 'MAX_PIXELES_FONDO', 100 * 100)
    assert carnet_pdf._bytes_fondo_cover(_png(200, 200), 100.0, 150.0) is None
    assert carnet_pdf._bytes_fondo_cover(_png(80, 80), 100.0, 150.0) is not None


def test_h11_el_fondo_respeta_la_orientacion_exif():
    carnet_pdf._bytes_fondo_cover.cache_clear()
    # JPEG apaisado (300x100) con orientación EXIF 6: debe verse vertical (100x300).
    img = Image.new('RGB', (300, 100), (0, 0, 255))
    exif = img.getexif()
    exif[0x0112] = 6
    b = BytesIO()
    img.save(b, 'JPEG', exif=exif.tobytes())
    salida = carnet_pdf._bytes_fondo_cover(b.getvalue(), 100.0, 300.0)
    with Image.open(BytesIO(salida)) as resultado:
        # Si no se girara, el recorte «cover» de una imagen apaisada en una caja vertical
        # dejaría solo una franja central; girada, se aprovecha entera sin recortar.
        assert resultado.height > resultado.width
        assert resultado.height / resultado.width == pytest.approx(3, rel=0.05)


def test_k6_el_fondo_se_procesa_una_vez_por_lote(monkeypatch):
    carnet_pdf._bytes_fondo_cover.cache_clear()
    datos = _png(400, 400)
    llamadas = []
    original = carnet_pdf._codificar_foto

    def contar(img):
        llamadas.append(1)
        return original(img)

    monkeypatch.setattr(carnet_pdf, '_codificar_foto', contar)
    for _ in range(20):
        carnet_pdf._bytes_fondo_cover(datos, 150.0, 240.0)
    assert len(llamadas) == 1


def test_k4_un_pdf_de_fondo_ilegible_no_se_reintenta_en_cada_tarjeta(monkeypatch):
    from django.core.cache import cache
    cache.clear()
    intentos = []
    monkeypatch.setattr(carnet_pdf, 'imagen_de_biblioteca', lambda medio: b'%PDF-1.4 roto')

    def falla(_datos):
        intentos.append(1)
        raise ValidationError('ilegible')

    monkeypatch.setattr(carnet_pdf, 'rasterizar_primera_pagina_pdf', falla)
    for _ in range(5):
        assert carnet_pdf.fondo_de_biblioteca('m-1') is None
    assert len(intentos) == 1


def test_k12_los_listados_omiten_las_imagenes_incrustadas_grandes():
    from apps.carnetizacion.presentation.views.carnetizacion_views import _definicion_para_listado

    grande = 'data:image/png;base64,' + 'A' * 5000
    filas = [{'definicion': {'anverso': [
        {'id': 'legacy-fondo', 'props': {'data': grande}},
        {'id': 'chica', 'props': {'data': 'data:image/png;base64,AAAA'}},
    ], 'reverso': []}}, {'definicion': None}]
    salida = _definicion_para_listado(filas)
    fondo, chica = salida[0]['definicion']['anverso']
    assert 'data' not in fondo['props'] and fondo['props']['data_omitida'] is True
    assert chica['props']['data'] == 'data:image/png;base64,AAAA'
