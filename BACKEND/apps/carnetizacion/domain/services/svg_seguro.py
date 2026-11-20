"""Saneamiento de SVG para medios ya almacenados (B-8).

La biblioteca **no acepta** SVG nuevos: ReportLab no incrusta SVG en el PDF del
carnet y rasterizarlo exigiría una dependencia nativa que el proyecto no tiene.
Este módulo queda para los SVG que ya estén guardados de antes: antes de
servirlos se pasan por una lista blanca estricta de etiquetas y atributos, de
modo que el navegador nunca reciba contenido activo.

No sustituye a un *sanitizador* de propósito general: si el documento no se
puede interpretar de forma segura (DTD, entidades, XML inválido o demasiado
profundo) se devuelve ``None`` y quien sirve el archivo debe usar
``application/octet-stream`` como adjunto.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

SVG_NS = 'http://www.w3.org/2000/svg'
XLINK_NS = 'http://www.w3.org/1999/xlink'

MAX_PROFUNDIDAD = 64

# Etiquetas puramente gráficas. Quedan fuera, entre otras, script, style,
# foreignObject, iframe, embed, image, a, animate, set, filter y metadata.
TAG_PERMITIDOS = {
    'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
    'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan',
    'linearGradient', 'radialGradient', 'stop',
    'clipPath', 'mask', 'pattern', 'marker',
}

TAG_CON_TEXTO = {'title', 'desc', 'text', 'tspan'}

ATRIBUTOS_PERMITIDOS = {
    'id', 'class', 'version', 'role', 'focusable',
    'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
    'width', 'height', 'viewBox', 'preserveAspectRatio', 'transform', 'points',
    'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
    'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
    'stroke-dashoffset', 'stroke-miterlimit', 'opacity', 'clip-path',
    'clip-rule', 'mask',
    'offset', 'stop-color', 'stop-opacity', 'gradientUnits',
    'gradientTransform', 'spreadMethod', 'fx', 'fy', 'fr',
    'patternUnits', 'patternContentUnits', 'patternTransform',
    'markerWidth', 'markerHeight', 'refX', 'refY', 'orient',
    'text-anchor', 'dominant-baseline', 'font-family', 'font-size',
    'font-weight', 'font-style', 'letter-spacing', 'word-spacing',
    'pathLength',
}

# Un DOCTYPE permite declarar entidades (XXE / "billion laughs"): no se intenta
# sanear, se rechaza el documento completo.
_DTD = re.compile(r'(?is)<!DOCTYPE|<!ENTITY')
_URL_FUNCION = re.compile(r'(?i)url\s*\(\s*[\'"]?\s*([^\'")]+)')
_TOKENS_PELIGROSOS = re.compile(
    r'(?i)(javascript\s*:|vbscript\s*:|data\s*:|expression\s*\(|@import|behavior\s*:)'
)
_ID_FRAGMENTO = re.compile(r'^[A-Za-z_][\w:.-]*$')


def parece_svg(contenido: bytes) -> bool:
    """True si los primeros bytes se parecen a un SVG (no valida el XML)."""
    muestra = contenido[:8192].lstrip().lower()
    return b'<svg' in muestra


def sanear_svg(contenido: bytes) -> bytes | None:
    """Devuelve un SVG equivalente limitado a la lista blanca, o ``None`` si no
    se puede garantizar que sea inerte."""
    try:
        texto = contenido.decode('utf-8')
    except (UnicodeDecodeError, AttributeError):
        return None

    if _DTD.search(texto):
        return None

    try:
        raiz = ET.fromstring(texto)
    except (ET.ParseError, ValueError, RecursionError):
        return None

    if _nombre_local(raiz.tag) != 'svg':
        return None

    try:
        limpia = _limpiar(raiz, profundidad=0)
    except RecursionError:
        return None
    if limpia is None:
        return None

    ET.register_namespace('', SVG_NS)
    ET.register_namespace('xlink', XLINK_NS)
    return ET.tostring(limpia, encoding='utf-8', xml_declaration=True)


def _nombre_local(nombre: str) -> str:
    if not isinstance(nombre, str):
        return ''
    return nombre.rsplit('}', 1)[-1]


def _valor_seguro(valor: str) -> bool:
    if _TOKENS_PELIGROSOS.search(valor):
        return False
    # url(...) solo puede apuntar a un recurso interno del propio SVG (#id).
    for destino in _URL_FUNCION.findall(valor):
        if not destino.strip().startswith('#'):
            return False
    return True


def _limpiar(elemento: ET.Element, profundidad: int) -> ET.Element | None:
    if profundidad > MAX_PROFUNDIDAD:
        return None

    etiqueta = _nombre_local(elemento.tag)
    if etiqueta not in TAG_PERMITIDOS:
        return None

    limpio = ET.Element(f'{{{SVG_NS}}}{etiqueta}')

    for nombre, valor in elemento.attrib.items():
        atributo = _nombre_local(nombre)
        if atributo.lower().startswith('on'):
            continue
        if atributo == 'href':
            # Solo referencias internas (#simbolo). Cualquier URL externa,
            # data: o javascript: se descarta.
            if valor.startswith('#') and _ID_FRAGMENTO.match(valor[1:]):
                clave = f'{{{XLINK_NS}}}href' if nombre.startswith('{') else 'href'
                limpio.set(clave, valor)
            continue
        if atributo not in ATRIBUTOS_PERMITIDOS:
            continue
        if not _valor_seguro(valor):
            continue
        limpio.set(atributo, valor)

    if etiqueta in TAG_CON_TEXTO:
        limpio.text = elemento.text

    for hijo in list(elemento):
        hijo_limpio = _limpiar(hijo, profundidad + 1)
        if hijo_limpio is None:
            continue
        if etiqueta in TAG_CON_TEXTO:
            hijo_limpio.tail = hijo.tail
        limpio.append(hijo_limpio)

    return limpio
