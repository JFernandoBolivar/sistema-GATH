"""
Generador fiel del PDF físico del carnet institucional (O44 - E8).
Permite renderizar credenciales de alta fidelidad directamente desde la definición
canónica JSON de la plantilla (en mm, dos caras, reglas de color dinámicas,
geometría vectorial y tipografía embebida con fallback métrico exacto).

Mantiene total compatibilidad con DatosCarnetPdf y la API previa de generar_carnet_pdf.
"""
import hashlib
import json
import logging
import math
import os
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

from apps.carnetizacion.domain.services.qr_estilo import normalizar_estilo
from apps.carnetizacion.infrastructure.qr_institucional import LOGO_QR, generar_qr_png
from django.conf import settings
from django.core.cache import cache
from PIL import Image
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from core.infrastructure.pdf.pdf_components import reducir_imagen_para_pdf, ruta_asset
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_trabajador,
)
from apps.carnetizacion.domain.services.resolver_color import (
    resolver_color_carnet,
)
from apps.carnetizacion.domain.services.validador_multimedia import detectar_mime

logger = logging.getLogger('gath.carnetizacion')

# Factor de conversión canónico: 1 mm = 72 / 25.4 puntos tipográficos
MM_A_PT = 72.0 / 25.4

# Dimensiones estándar ID-1 (54 x 85.6 mm)
CARNET_WIDTH = 54.0 * MM_A_PT
CARNET_HEIGHT = 85.6 * MM_A_PT

_TEXTO_MAX_ANCHO = 2.5 * cm
_TEXTO_MIN_FUENTE = 5

# La foto se dibuja en un recuadro de ~2 cm: basta con 300 ppp de impresión. El piso de
# 600 px evita perder calidad en recuadros pequeños y es la clave de tamaño de la caché.
LADO_FOTO_MIN_PX = 600
_CALIDAD_JPEG_FOTO = 88
_TTL_QR_SEGUNDOS = 300


MARGEN_TARJETA_PT = 0.8 * MM_A_PT


def _limitar_caja_a_tarjeta(x_pt: float, w_pt: float, ancho_tarjeta_pt: float) -> tuple[float, float]:
    """Recorta la caja horizontal para que quede dentro de la tarjeta (con un margen mínimo)."""
    izquierda = min(max(x_pt, 0.0), max(ancho_tarjeta_pt - MARGEN_TARJETA_PT, 0.0))
    derecha = min(x_pt + w_pt, ancho_tarjeta_pt - MARGEN_TARJETA_PT)
    return izquierda, max(derecha - izquierda, 1.0)


def _recortar_con_puntos(texto: str, fuente: str, tamano: float, ancho: float) -> str:
    """Recorta el texto con «…» hasta que quepa en `ancho`."""
    if stringWidth(texto, fuente, tamano) <= ancho:
        return texto
    while texto and stringWidth(texto + '…', fuente, tamano) > ancho:
        texto = texto[:-1]
    return (texto.rstrip() + '…') if texto else ''


def _partir_en_dos(texto: str, fuente: str, tamano: float, ancho: float) -> list[str] | None:
    """Reparte el texto en 2 líneas por palabras; None si alguna línea no cabe."""
    palabras = texto.split()
    mejor: list[str] | None = None
    for corte in range(1, len(palabras)):
        lineas = [' '.join(palabras[:corte]), ' '.join(palabras[corte:])]
        if all(stringWidth(ln, fuente, tamano) <= ancho for ln in lineas):
            if mejor is None or max(map(len, lineas)) < max(map(len, mejor)):
                mejor = lineas
    return mejor


def ajustar_texto(
    texto: str, fuente: str, tamano: float, ancho: float, alto: float,
) -> tuple[list[str], float]:
    """Líneas y tamaño con los que el texto cabe en la caja (`ancho` x `alto`, en puntos).

    1) Reduce la letra hasta `_TEXTO_MIN_FUENTE` pt; 2) si aun así no cabe y la caja tiene
    alto para 2 líneas, parte por palabras; 3) si no, recorta con «…». Un texto con saltos
    de línea explícitos conserva sus líneas y solo se reduce/recorta.
    """
    if not texto or ancho <= 0:
        return [texto or ''], tamano
    lineas = texto.split('\n')
    ancho_max = max(stringWidth(ln, fuente, tamano) for ln in lineas)
    if ancho_max > ancho:
        tamano = max(_TEXTO_MIN_FUENTE if tamano > _TEXTO_MIN_FUENTE else tamano, tamano * ancho / ancho_max)
    # La reducción proporcional puede quedar un pelo corta por el redondeo de métricas.
    while tamano > _TEXTO_MIN_FUENTE and max(stringWidth(ln, fuente, tamano) for ln in lineas) > ancho:
        tamano = max(_TEXTO_MIN_FUENTE, tamano - 0.1)
    if all(stringWidth(ln, fuente, tamano) <= ancho for ln in lineas):
        return lineas, tamano
    if len(lineas) == 1 and alto >= 2 * tamano * 1.15:
        dos = _partir_en_dos(lineas[0], fuente, tamano, ancho)
        if dos:
            return dos, tamano
    return [_recortar_con_puntos(ln, fuente, tamano, ancho) for ln in lineas], tamano


def _tiene_transparencia(img: Image.Image) -> bool:
    return img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)


def _lado_maximo_px(ancho_pt: float, alto_pt: float) -> int:
    """Lado largo a 300 ppp del recuadro (puntos -> pulgadas), con piso de LADO_FOTO_MIN_PX."""
    return max(LADO_FOTO_MIN_PX, math.ceil(max(ancho_pt, alto_pt) / 72.0 * 300))


def _codificar_foto(img: Image.Image) -> bytes:
    """JPEG q88 en RGB; PNG (ya reducido) solo si la foto trae transparencia."""
    salida = BytesIO()
    if _tiene_transparencia(img):
        img.convert('RGBA').save(salida, format='PNG')
    else:
        img.convert('RGB').save(salida, format='JPEG', quality=_CALIDAD_JPEG_FOTO)
    return salida.getvalue()


def reducir_foto_carnet(foto_bytes: bytes, lado_max: int = LADO_FOTO_MIN_PX) -> bytes:
    """Reduce la foto a un lado largo <= lado_max y la recodifica (JPEG, o PNG con alfa)."""
    with Image.open(BytesIO(foto_bytes)) as img:
        img.load()
        if max(img.size) > lado_max:
            img.thumbnail((lado_max, lado_max), Image.LANCZOS)
        return _codificar_foto(img)


@dataclass(frozen=True)
class DatosCarnetPdf:
    nombre_completo: str
    cedula: str
    cargo: str
    departamento: str
    security_hash: str
    nomina: str = "Funcionario"
    plantilla_path: str | None = None
    foto_bytes: bytes | None = None
    vence: str = ''
    # Valores de los campos personalizados ya resueltos por su origen: {codigo_del_campo: valor}.
    campos_extra: dict[str, str] = field(default_factory=dict)


def _hex_seguro(valor: str | None, defecto: str = '#111827') -> HexColor:
    """Convierte un string hex a HexColor de forma segura contra formatos inválidos."""
    if not valor or not isinstance(valor, str):
        return HexColor(defecto)
    val = valor.strip()
    if not val.startswith('#'):
        val = f"#{val}"
    try:
        return HexColor(val)
    except Exception:
        return HexColor(defecto)


def _bytes_de_biblioteca(medio_id: str | None, prefijo_cache: str) -> bytes | None:
    """Bytes de un archivo de la Biblioteca de Medios (vía `obtener_archivo_biblioteca`),
    cacheados unos minutos; None si no hay medio o no se puede leer."""
    if not medio_id:
        return None
    clave = f"{prefijo_cache}:{medio_id}"
    try:
        guardado = cache.get(clave)
        if guardado:
            if detectar_mime(guardado) == 'image/svg+xml':
                logger.warning(
                    "El medio %s de la biblioteca es SVG y ReportLab no lo dibuja; se ignora.",
                    medio_id,
                )
                return None
            return guardado
    except Exception:
        logger.warning("Caché no disponible al leer el medio %s de la biblioteca.", medio_id, exc_info=True)
    try:
        from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
            RepoCarnetizacionORM,
        )

        datos, _mime, _nombre = RepoCarnetizacionORM().obtener_archivo_biblioteca(medio_id)
    except Exception:
        logger.warning("No se pudo leer el medio %s de la biblioteca.", medio_id)
        return None
    # B-8: los SVG históricos siguen descargándose desde la API, pero no se
    # intentan incrustar en el PDF (ReportLab no los soporta); así se usa el
    # asset de respaldo o el marcador, sin un recuadro silencioso.
    if detectar_mime(datos) == 'image/svg+xml':
        logger.warning(
            "El medio %s de la biblioteca es SVG y ReportLab no lo dibuja; se ignora.",
            medio_id,
        )
        return None
    try:
        cache.set(clave, datos, _TTL_QR_SEGUNDOS)
    except Exception:
        logger.warning("Caché no disponible al guardar el medio %s de la biblioteca.", medio_id, exc_info=True)
    return datos


def logo_qr_de_biblioteca(medio_id: str | None) -> bytes | None:
    """Bytes del logo del QR elegido en la Biblioteca de Medios; None si no hay medio o no se
    puede leer (entonces se usa el logo de CONATEL)."""
    return _bytes_de_biblioteca(medio_id, "carnet:qr-logo")


def imagen_de_biblioteca(medio_id: str | None) -> bytes | None:
    """Bytes de una imagen de la biblioteca colocada en el carnet (logo, firma, sello)."""
    return _bytes_de_biblioteca(medio_id, "carnet:imagen")


def _qr_png_cacheado(contenido: str, con_logo: bool, estilo: dict[str, Any] | None = None) -> bytes:
    """QR cacheado: la clave cubre el contenido (que lleva el security_hash), el estilo
    normalizado y la versión del logo (mtime y tamaño del archivo de CONATEL, o el id del
    medio de la biblioteca), así que un cambio de estilo o de logo invalida."""
    estilo = normalizar_estilo(estilo)
    medio_id = estilo['logo']['medio_id'] if con_logo and estilo['logo']['activo'] else None
    sello_logo = f"medio:{medio_id}" if medio_id else ''
    if con_logo and not medio_id:
        try:
            ruta = ruta_asset(LOGO_QR)
            if ruta:
                st = os.stat(ruta)
                sello_logo = f"{st.st_mtime_ns}-{st.st_size}"
        except Exception:
            sello_logo = ''
    huella = hashlib.sha256(
        f"{contenido}|{int(con_logo)}|{sello_logo}|{json.dumps(estilo, sort_keys=True)}".encode()
    ).hexdigest()
    clave = f"carnet:qr:{huella}"
    try:
        guardado = cache.get(clave)
        if guardado:
            return guardado
    except Exception:
        logger.warning("Caché no disponible al leer el QR del carnet.", exc_info=True)
    png = generar_qr_png(
        contenido, box_size=4, border=2, con_logo=con_logo, estilo=estilo,
        logo_bytes=logo_qr_de_biblioteca(medio_id),
    )
    try:
        cache.set(clave, png, _TTL_QR_SEGUNDOS)
    except Exception:
        logger.warning("Caché no disponible al guardar el QR del carnet.", exc_info=True)
    return png


def _dibujar_qr(
    c: canvas.Canvas,
    datos: DatosCarnetPdf | dict[str, Any],
    x: float,
    y: float,
    tamano: float = 1.2 * cm,
    con_logo: bool = True,
    estilo: dict[str, Any] | None = None,
) -> None:
    """Genera y dibuja el código QR seguro con el logo institucional al centro."""
    sec_hash = getattr(datos, 'security_hash', None) or (datos.get('security_hash') if isinstance(datos, dict) else '')
    cedula = getattr(datos, 'cedula', None) or (datos.get('cedula') if isinstance(datos, dict) else '')
    nombre = getattr(datos, 'nombre_completo', None) or (datos.get('nombre_completo') if isinstance(datos, dict) else '')

    from apps.carnetizacion.infrastructure.qr_institucional import contenido_qr_carnet

    contenido = contenido_qr_carnet(sec_hash, cedula, nombre)

    c.drawImage(
        ImageReader(BytesIO(_qr_png_cacheado(contenido, con_logo, estilo))),
        x, y, tamano, tamano,
    )


def _dibujar_placeholder_foto(c: canvas.Canvas, x: float, y: float, ancho: float, alto: float, rad: float = 0) -> None:
    """Dibuja una silueta estilizada cuando el trabajador aún no tiene fotografía cargada."""
    c.saveState()
    c.setFillColorRGB(0.92, 0.94, 0.96)
    c.setStrokeColorRGB(0.8, 0.84, 0.9)
    c.setLineWidth(0.5)
    c.roundRect(x, y, ancho, alto, rad, fill=1, stroke=1)

    # Silueta de avatar humano
    c.setFillColorRGB(0.65, 0.7, 0.78)
    radio_cabeza = min(ancho, alto) * 0.18
    centro_x = x + ancho / 2
    cabeza_y = y + alto * 0.58
    c.circle(centro_x, cabeza_y, radio_cabeza, fill=1, stroke=0)

    c.ellipse(centro_x - ancho * 0.35, y + alto * 0.05, centro_x + ancho * 0.35, y + alto * 0.42, fill=1, stroke=0)
    c.restoreState()


def _dibujar_foto(c: canvas.Canvas, foto_bytes: bytes | None, x: float, y: float, ancho: float, alto: float, rad: float = 0) -> None:
    """Dibuja la foto del titular ajustada proporcionalmente y recortada al recuadro."""
    if foto_bytes:
        try:
            pil_image = Image.open(BytesIO(foto_bytes))
            target_ratio = ancho / alto
            img_width, img_height = pil_image.size
            img_ratio = img_width / img_height
            if img_ratio > target_ratio:
                nuevo_ancho = int(img_height * target_ratio)
                offset = (img_width - nuevo_ancho) // 2
                pil_image = pil_image.crop((offset, 0, offset + nuevo_ancho, img_height))
            elif img_ratio < target_ratio:
                nuevo_alto = int(img_width / target_ratio)
                offset = (img_height - nuevo_alto) // 2
                pil_image = pil_image.crop((0, offset, img_width, offset + nuevo_alto))

            # Reducir al tamaño útil de impresión (300 ppp) ANTES de recodificar: a tamaño
            # completo, guardar como PNG y recomprimir en drawImage costaba ~12 s.
            lado_max = _lado_maximo_px(ancho, alto)
            if max(pil_image.size) > lado_max:
                pil_image.thumbnail((lado_max, lado_max), Image.LANCZOS)
            c.drawImage(
                ImageReader(BytesIO(_codificar_foto(pil_image))),
                x, y, ancho, alto, preserveAspectRatio=True, anchor="c",
            )
            return
        except Exception:
            logger.warning("No se pudo procesar la foto del carnet; usando silueta de respaldo.", exc_info=True)

    _dibujar_placeholder_foto(c, x, y, ancho, alto, rad)


def _extraer_valor_campo(campo: str, datos: DatosCarnetPdf | dict[str, Any]) -> str:
    """Resuelve el valor del campo a partir del objeto o diccionario del titular."""
    if isinstance(datos, DatosCarnetPdf):
        mapa = {
            'nombre': datos.nombre_completo,
            'nombre_completo': datos.nombre_completo,
            'cedula': datos.cedula,
            'cargo': datos.cargo,
            'departamento': datos.departamento,
            'oficina': datos.departamento,
            'nomina': datos.nomina,
            'tipo_personal': datos.nomina,
            'vence': datos.vence,
        }
        return mapa.get(campo, '')
    if isinstance(datos, dict):
        return str(datos.get(campo, '') or '')
    return ''


def _num_path(valor: float) -> str:
    """Número como lo escribe el diseñador: dos decimales sin ceros sobrantes."""
    texto = f'{valor:.2f}'.rstrip('0').rstrip('.')
    return '0' if texto in ('', '-0') else texto


def _puntos_validos(valor: Any) -> list[dict[str, float]] | None:
    """Lee `props.puntos` ({x, y, r} en la caja 0..100); None si no es una lista usable."""
    if not isinstance(valor, list) or len(valor) < 3:
        return None
    lista: list[dict[str, float]] = []
    for p in valor:
        if not isinstance(p, dict):
            return None
        try:
            x, y = float(p.get('x')), float(p.get('y'))
            r = float(p.get('r') or 0)
        except (TypeError, ValueError):
            return None
        if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(r)):
            return None
        lista.append({'x': min(100.0, max(0.0, x)), 'y': min(100.0, max(0.0, y)), 'r': max(0.0, r)})
    return lista


def path_desde_puntos(puntos: list[dict[str, float]], w_mm: float, h_mm: float) -> str:
    """Path SVG (caja 0..100) de una forma por vértices; igual a `generarPathDesdePuntos` del diseñador.

    Cada vértice con `r` > 0 se redondea con una curva Q cuyo control es el vértice; el radio
    (mm) se limita a la mitad de la más corta de sus dos aristas.
    """
    n = len(puntos)
    if n < 3 or not (w_mm > 0) or not (h_mm > 0):
        return ''
    mm = [(p['x'] * w_mm / 100, p['y'] * h_mm / 100) for p in puntos]

    def caja(x: float, y: float) -> str:
        return f'{_num_path(x * 100 / w_mm)} {_num_path(y * 100 / h_mm)}'

    partes: list[str] = []
    for i, (px_, py_) in enumerate(mm):
        orden = 'M' if i == 0 else 'L'
        r = puntos[i]['r']
        tramo = None
        if r > 0:
            prev, nxt = mm[(i - 1) % n], mm[(i + 1) % n]
            lp = math.hypot(prev[0] - px_, prev[1] - py_)
            ln = math.hypot(nxt[0] - px_, nxt[1] - py_)
            if lp != 0 and ln != 0:
                d = min(r, lp / 2, ln / 2)
                tramo = (
                    (px_ + (prev[0] - px_) / lp * d, py_ + (prev[1] - py_) / lp * d),
                    (px_ + (nxt[0] - px_) / ln * d, py_ + (nxt[1] - py_) / ln * d),
                )
        if tramo is None:
            partes.append(f'{orden} {caja(px_, py_)}')
        else:
            ini, fin = tramo
            partes.append(f'{orden} {caja(*ini)} Q {caja(px_, py_)} {caja(*fin)}')
    return ' '.join(partes) + ' Z'


def _radios_esquinas_mm(valor: Any, w_mm: float, h_mm: float) -> list[float] | None:
    """`props.radios` [sup-izq, sup-der, inf-der, inf-izq] en mm, acotados a la mitad del lado menor."""
    if not isinstance(valor, (list, tuple)) or len(valor) != 4:
        return None
    try:
        radios = [float(r) for r in valor]
    except (TypeError, ValueError):
        return None
    if not all(math.isfinite(r) for r in radios):
        return None
    tope = max(0.0, min(w_mm, h_mm) / 2)
    return [min(tope, max(0.0, r)) for r in radios]


def _dibujar_rect_radios(
    c: canvas.Canvas, x: float, y: float, w: float, h: float, radios_pt: list[float], relleno: bool, borde: bool,
) -> None:
    """Rectángulo con un radio por esquina [sup-izq, sup-der, inf-der, inf-izq] (cada esquina es una Q)."""
    tl, tr, br, bl = radios_pt
    path = c.beginPath()

    def esquina(p0: tuple[float, float], ctrl: tuple[float, float], p1: tuple[float, float]) -> None:
        path.curveTo(
            p0[0] + 2 / 3 * (ctrl[0] - p0[0]), p0[1] + 2 / 3 * (ctrl[1] - p0[1]),
            p1[0] + 2 / 3 * (ctrl[0] - p1[0]), p1[1] + 2 / 3 * (ctrl[1] - p1[1]),
            p1[0], p1[1],
        )

    path.moveTo(x + tl, y + h)
    path.lineTo(x + w - tr, y + h)
    esquina((x + w - tr, y + h), (x + w, y + h), (x + w, y + h - tr))
    path.lineTo(x + w, y + br)
    esquina((x + w, y + br), (x + w, y), (x + w - br, y))
    path.lineTo(x + bl, y)
    esquina((x + bl, y), (x, y), (x, y + bl))
    path.lineTo(x, y + h - tl)
    esquina((x, y + h - tl), (x, y + h), (x + tl, y + h))
    path.close()
    c.drawPath(path, fill=1 if relleno else 0, stroke=1 if borde else 0)


def _dibujar_svg_path(
    c: canvas.Canvas,
    datos: str | None,
    x_pt: float,
    y_pt: float,
    w_pt: float,
    h_pt: float,
    fill_color,
    stroke_color,
    sw_pt: float,
) -> None:
    """Dibuja una forma libre SVG normalizada en una caja de 0..100.

    Soporta M, L, H, V, C, Q y Z (absolutos o relativos), suficiente para las
    ondas, cortes diagonales y blobs del diseñador.
    """
    import re

    tokens = re.findall(r'[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?', str(datos or ''))
    if not tokens:
        return

    def px(valor: float) -> float:
        return x_pt + (valor / 100.0) * w_pt

    def py(valor: float) -> float:
        return y_pt + h_pt - (valor / 100.0) * h_pt

    path = c.beginPath()
    i = 0
    comando = None
    inicio = (0.0, 0.0)
    actual = (0.0, 0.0)

    while i < len(tokens):
        token = tokens[i]
        if token.isalpha():
            comando = token
            i += 1
            if comando.upper() == 'Z':
                path.close()
                actual = inicio
                continue
        if comando is None:
            i += 1
            continue

        relativo = comando.islower()
        operacion = comando.upper()
        try:
            if operacion == 'M':
                x, y = float(tokens[i]), float(tokens[i + 1])
                i += 2
                if relativo:
                    x, y = x + actual[0], y + actual[1]
                actual = (x, y)
                inicio = actual
                path.moveTo(px(x), py(y))
                comando = 'l' if relativo else 'L'
            elif operacion == 'L':
                x, y = float(tokens[i]), float(tokens[i + 1])
                i += 2
                if relativo:
                    x, y = x + actual[0], y + actual[1]
                actual = (x, y)
                path.lineTo(px(x), py(y))
            elif operacion == 'H':
                x = float(tokens[i])
                i += 1
                if relativo:
                    x += actual[0]
                actual = (x, actual[1])
                path.lineTo(px(actual[0]), py(actual[1]))
            elif operacion == 'V':
                y = float(tokens[i])
                i += 1
                if relativo:
                    y += actual[1]
                actual = (actual[0], y)
                path.lineTo(px(actual[0]), py(actual[1]))
            elif operacion == 'C':
                x1, y1 = float(tokens[i]), float(tokens[i + 1])
                x2, y2 = float(tokens[i + 2]), float(tokens[i + 3])
                x, y = float(tokens[i + 4]), float(tokens[i + 5])
                i += 6
                if relativo:
                    x1, y1 = x1 + actual[0], y1 + actual[1]
                    x2, y2 = x2 + actual[0], y2 + actual[1]
                    x, y = x + actual[0], y + actual[1]
                path.curveTo(px(x1), py(y1), px(x2), py(y2), px(x), py(y))
                actual = (x, y)
            elif operacion == 'Q':
                x1, y1 = float(tokens[i]), float(tokens[i + 1])
                x, y = float(tokens[i + 2]), float(tokens[i + 3])
                i += 4
                if relativo:
                    x1, y1 = x1 + actual[0], y1 + actual[1]
                    x, y = x + actual[0], y + actual[1]
                c1 = (actual[0] + 2 / 3 * (x1 - actual[0]), actual[1] + 2 / 3 * (y1 - actual[1]))
                c2 = (x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y))
                path.curveTo(px(c1[0]), py(c1[1]), px(c2[0]), py(c2[1]), px(x), py(y))
                actual = (x, y)
            else:
                i += 1
        except (IndexError, ValueError):
            break

    c.setFillColor(fill_color)
    if sw_pt > 0 and stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(sw_pt)
    c.drawPath(path, fill=1, stroke=1 if (sw_pt > 0 and stroke_color) else 0)


def _normalizar_datos(datos: DatosCarnetPdf | dict[str, Any]) -> tuple[dict[str, Any], bytes | None]:
    """Datos del titular como diccionario (para reglas y campos) y bytes de su foto."""
    if isinstance(datos, DatosCarnetPdf):
        datos_dict = {
            'nombre_completo': datos.nombre_completo,
            'cedula': datos.cedula,
            'cargo': datos.cargo,
            'departamento': datos.departamento,
            'oficina': datos.departamento,
            'nomina': datos.nomina,
            'security_hash': datos.security_hash,
            'vence': datos.vence,
        }
        # Los campos personalizados nunca pisan los datos base del titular.
        return {**datos.campos_extra, **datos_dict}, datos.foto_bytes
    return datos, datos.get('foto_bytes')


def dimensiones_mm(definicion: dict[str, Any]) -> tuple[float, float]:
    """(ancho, alto) de la tarjeta en mm según la definición (ID-1 vertical por defecto)."""
    dims = definicion.get('dimensiones', {}) or {}
    ancho_mm = float(definicion.get('ancho_mm') or dims.get('ancho_mm') or 54.0)
    alto_mm = float(definicion.get('alto_mm') or dims.get('alto_mm') or 85.6)
    return ancho_mm, alto_mm


def elementos_de_cara(definicion: dict[str, Any], cara: str) -> list[dict[str, Any]]:
    """Elementos de `cara` ('anverso'/'reverso'), en formato por caras o en el formato plano heredado."""
    if 'anverso' in definicion and 'reverso' in definicion:
        return list(definicion.get(cara, []) or [])
    return [e for e in definicion.get('elementos', []) or [] if (e.get('cara') or 'anverso') == cara]


def _resolver_color(val: str | None, colores_regla: dict[str, Any], defecto: str = '#111827') -> HexColor:
    if not val:
        return HexColor(defecto)
    if val == 'rule:primario':
        return _hex_seguro(colores_regla.get('primario'), '#1f3a5f')
    if val == 'rule:acento':
        return _hex_seguro(colores_regla.get('acento'), '#1273bd')
    if val == 'rule:texto':
        return _hex_seguro(colores_regla.get('texto'), '#ffffff')
    return _hex_seguro(val, defecto)


def _numero(valor: Any, defecto: float = 0.0) -> float:
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return defecto
    return n if math.isfinite(n) else defecto


def _con_alfa(color: Color, alfa: float) -> Color:
    """El mismo color con transparencia. ReportLab restablece el alfa del estado gráfico al
    del color en cada `setFillColor`/`setStrokeColor`, así que la opacidad tiene que viajar
    en el propio color; `setFillAlpha` sola se perdería en el siguiente cambio de color."""
    if alfa >= 1.0:
        return color
    return Color(color.red, color.green, color.blue, alpha=alfa)


def _opacidad(el: dict[str, Any], props: dict[str, Any]) -> float:
    """Opacidad 0..1 del elemento; el diseñador la guarda como `op` en 0..100."""
    op = el.get('op', props.get('op'))
    if op is None:
        return 1.0
    return min(1.0, max(0.0, _numero(op, 100.0) / 100.0))


def _imagen_elemento(props: dict[str, Any], w_pt: float, h_pt: float) -> ImageReader | None:
    """Imagen de un elemento `image`: primero la de la biblioteca (`biblioteca_id`), después el
    asset institucional fijo (`asset`). None si no hay ninguna legible."""
    medio_id = props.get('biblioteca_id')
    if medio_id:
        datos = imagen_de_biblioteca(str(medio_id))
        if datos:
            return ImageReader(BytesIO(reducir_imagen_para_pdf(datos, _lado_maximo_px(w_pt, h_pt))))
    asset = props.get('asset')
    ruta = ruta_asset(asset) if asset else None
    return ImageReader(ruta) if ruta else None


def _dibujar_elemento(
    c: canvas.Canvas,
    el: dict[str, Any],
    datos_dict: dict[str, Any],
    foto_bytes: bytes | None,
    colores_regla: dict[str, Any],
    ancho_pt: float,
    alto_mm: float,
) -> None:
    """Dibuja un elemento en coordenadas locales de la tarjeta (origen abajo a la izquierda)."""
    tipo = el.get('tipo') or el.get('t')
    props = el.get('props', {}) or {}

    x_mm = _numero(el.get('x'))
    y_mm = _numero(el.get('y'))
    w_mm = _numero(el.get('w'), 10.0)
    h_mm = _numero(el.get('h'), 10.0)

    # Conversión milimétrica a puntos con origen superior invertido
    x_pt = x_mm * MM_A_PT
    w_pt = w_mm * MM_A_PT
    h_pt = h_mm * MM_A_PT
    y_pt = (alto_mm - y_mm - h_mm) * MM_A_PT

    opacidad = _opacidad(el, props)

    raw_fill = el.get('fill') or props.get('fill') or el.get('color') or props.get('color')
    fill_color = _con_alfa(_resolver_color(raw_fill, colores_regla, '#1f3a5f'), opacidad)

    stroke_raw = el.get('stroke') or props.get('stroke')
    stroke_color = _con_alfa(_hex_seguro(stroke_raw, '#111827'), opacidad) if stroke_raw else None
    sw_pt = _numero(el.get('sw') or props.get('sw')) * MM_A_PT
    tiene_stroke = sw_pt > 0 and stroke_raw

    c.saveState()

    # Rotación igual que Konva: grados en sentido horario alrededor de la esquina
    # superior izquierda del elemento (en PDF el eje Y sube, de ahí el signo).
    rotacion = _numero(el.get('r', el.get('rotation')))
    if rotacion:
        pivote_x, pivote_y = x_pt, y_pt + h_pt
        c.translate(pivote_x, pivote_y)
        c.rotate(-rotacion)
        c.translate(-pivote_x, -pivote_y)

    c.setFillColor(fill_color)
    if tiene_stroke:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(sw_pt)
    if opacidad < 1.0:
        # Para foto, QR e imágenes (drawImage no cambia de color, así que el alfa se mantiene).
        c.setFillAlpha(opacidad)
        c.setStrokeAlpha(opacidad)

    rad_pt = _numero(el.get('rad') or props.get('rad') or el.get('radius')) * MM_A_PT

    # Renderizado por tipo de primitiva gráfica
    if tipo in ('rect', 'forma'):
        radios_mm = _radios_esquinas_mm(props.get('radios') or el.get('radios'), w_mm, h_mm)
        if radios_mm is not None:
            _dibujar_rect_radios(
                c, x_pt, y_pt, w_pt, h_pt, [r * MM_A_PT for r in radios_mm], True, bool(tiene_stroke),
            )
        else:
            c.roundRect(x_pt, y_pt, w_pt, h_pt, rad_pt, fill=1, stroke=1 if tiene_stroke else 0)

    elif tipo in ('circle', 'ellipse'):
        c.ellipse(x_pt, y_pt, x_pt + w_pt, y_pt + h_pt, fill=1, stroke=1 if tiene_stroke else 0)

    elif tipo == 'tri':
        path = c.beginPath()
        path.moveTo(x_pt, y_pt)
        path.lineTo(x_pt + w_pt / 2, y_pt + h_pt)
        path.lineTo(x_pt + w_pt, y_pt)
        path.close()
        c.drawPath(path, fill=1, stroke=1 if tiene_stroke else 0)

    elif tipo == 'diag':
        # Franja superior/inferior diagonal
        path = c.beginPath()
        path.moveTo(x_pt, y_pt + h_pt)
        path.lineTo(x_pt + w_pt, y_pt + h_pt)
        path.lineTo(x_pt + w_pt * 0.72, y_pt)
        path.lineTo(x_pt, y_pt)
        path.close()
        c.drawPath(path, fill=1, stroke=1 if tiene_stroke else 0)

    elif tipo == 'diagr':
        # Acento diagonal opuesto
        path = c.beginPath()
        path.moveTo(x_pt + w_pt * 0.28, y_pt + h_pt)
        path.lineTo(x_pt + w_pt, y_pt + h_pt)
        path.lineTo(x_pt + w_pt, y_pt)
        path.lineTo(x_pt, y_pt)
        path.close()
        c.drawPath(path, fill=1, stroke=1 if tiene_stroke else 0)

    elif tipo == 'path':
        puntos = _puntos_validos(props.get('puntos'))
        path_forma = path_desde_puntos(puntos, w_mm, h_mm) if puntos else ''
        _dibujar_svg_path(
            c,
            path_forma or el.get('path') or props.get('d'),
            x_pt, y_pt, w_pt, h_pt,
            fill_color,
            stroke_color if tiene_stroke else None,
            sw_pt,
        )

    elif tipo in ('line', 'signline'):
        c.setLineWidth(max(h_pt, 0.4))
        c.setStrokeColor(fill_color)
        c.line(x_pt, y_pt + h_pt / 2, x_pt + w_pt, y_pt + h_pt / 2)

    elif tipo == 'photo':
        _dibujar_foto(c, foto_bytes, x_pt, y_pt, w_pt, h_pt, rad_pt)

    elif tipo == 'qr':
        _dibujar_qr(
            c, datos_dict, x_pt, y_pt,
            tamano=min(w_pt, h_pt),
            con_logo=bool(props.get('logo', True)),
            estilo=props.get('qr_estilo'),
        )

    elif tipo == 'image':
        # Logo, firma o sello: imagen de la biblioteca o asset institucional; si no hay
        # ninguna legible, se conserva el marcador de texto.
        dibujado = False
        try:
            imagen = _imagen_elemento(props, w_pt, h_pt)
            if imagen is not None:
                c.drawImage(
                    imagen, x_pt, y_pt, w_pt, h_pt,
                    preserveAspectRatio=True, anchor='c', mask='auto',
                )
                dibujado = True
        except Exception:
            logger.warning(
                "No se pudo dibujar la imagen del carnet (biblioteca=%s, asset=%s).",
                props.get('biblioteca_id'), props.get('asset'), exc_info=True,
            )
        if not dibujado:
            label = props.get('label') or el.get('name') or 'LOGO'
            c.setStrokeColor(fill_color)
            c.setLineWidth(0.6)
            c.roundRect(x_pt, y_pt, w_pt, h_pt, 1, fill=0, stroke=1)
            c.setFont(FUENTE_NEGRITA, min(h_pt * 0.45, 7))
            c.drawCentredString(x_pt + w_pt / 2, y_pt + (h_pt - 5) / 2, label)

    elif tipo in ('text', 'field'):
        # Resolución de cadena de texto
        if tipo == 'field':
            campo = el.get('campo') or el.get('field') or ''
            texto_render = _extraer_valor_campo(campo, datos_dict)
            if not texto_render:
                texto_render = el.get('nombre') or el.get('name') or ''
        else:
            texto_render = el.get('texto') or el.get('text') or ''

        if el.get('upper'):
            texto_render = texto_render.upper()

        font_size = _numero(el.get('fontSize') or el.get('size'), 7.5) or 7.5
        bold = bool(el.get('bold', False))
        fuente_elegida = FUENTE_NEGRITA if bold else FUENTE

        # La caja nunca pasa del borde de la tarjeta (menos el margen).
        x_txt, w_txt = _limitar_caja_a_tarjeta(x_pt, w_pt, ancho_pt)
        lineas, font_size = ajustar_texto(
            texto_render, fuente_elegida, font_size, w_txt, h_pt,
        )
        c.setFont(fuente_elegida, font_size)
        c.setFillColor(fill_color)

        align = el.get('align', 'left')
        interlineado = font_size * 1.2
        if len(lineas) > 1:
            total_h = len(lineas) * interlineado
            y_actual = y_pt + h_pt - (h_pt - total_h) / 2 - font_size
        else:
            y_actual = y_pt + (h_pt - font_size) / 2 + 0.5
        for linea in lineas:
            if align == 'center':
                c.drawCentredString(x_txt + w_txt / 2, y_actual, linea)
            elif align == 'right':
                c.drawRightString(x_txt + w_txt, y_actual, linea)
            else:
                c.drawString(x_txt, y_actual, linea)
            y_actual -= interlineado

    c.restoreState()


# Formato imprenta (B-3): margen alrededor del sangrado donde van las marcas de corte.
MARGEN_MARCAS_MM = 6.0
_TOLERANCIA_BORDE_MM = 0.05
_TIPOS_EXTENSIBLES = ('rect', 'forma')


def _extender_al_sangrado(el: dict[str, Any], ancho_mm: float, alto_mm: float, sangrado_mm: float) -> dict[str, Any]:
    """Un rectángulo que toca un borde de la tarjeta se prolonga hasta el borde del sangrado, para
    que un corte ligeramente desplazado no deje un filo blanco. Lo que no toca el borde (textos,
    foto, QR, formas libres) no se toca: deformarlo cambiaría el diseño."""
    if (el.get('tipo') or el.get('t')) not in _TIPOS_EXTENSIBLES:
        return el
    x, y = _numero(el.get('x')), _numero(el.get('y'))
    w, h = _numero(el.get('w'), 10.0), _numero(el.get('h'), 10.0)
    tol = _TOLERANCIA_BORDE_MM
    if x + w >= ancho_mm - tol:
        w = ancho_mm + sangrado_mm - x
    if x <= tol:
        w += x + sangrado_mm
        x = -sangrado_mm
    if y + h >= alto_mm - tol:
        h = alto_mm + sangrado_mm - y
    if y <= tol:
        h += y + sangrado_mm
        y = -sangrado_mm
    return {**el, 'x': x, 'y': y, 'w': w, 'h': h}


def _marcas_corte_individual(c: canvas.Canvas, x: float, y: float, ancho: float, alto: float,
                             sangrado: float, margen: float) -> None:
    """Marcas de corte en las cuatro esquinas del corte final, fuera del sangrado."""
    separacion = sangrado + 1 * MM_A_PT
    largo = max(margen - 1.5 * MM_A_PT, 2 * MM_A_PT)
    c.saveState()
    c.setStrokeColor(HexColor('#000000'))
    c.setLineWidth(0.25)
    for px, dx in ((x, -1), (x + ancho, 1)):
        for py, dy in ((y, -1), (y + alto, 1)):
            c.line(px + dx * separacion, py, px + dx * (separacion + largo), py)
            c.line(px, py + dy * separacion, px, py + dy * (separacion + largo))
    c.restoreState()


def dibujar_cara(
    c: canvas.Canvas,
    definicion: dict[str, Any],
    datos: DatosCarnetPdf | dict[str, Any],
    cara: str,
    x_offset: float = 0.0,
    y_offset: float = 0.0,
    sangrado_mm: float = 0.0,
) -> None:
    """Dibuja una cara completa de la credencial con su esquina inferior izquierda en
    (`x_offset`, `y_offset`). Es el ÚNICO dibujador de caras: lo usan el PDF individual y el
    de lote, así un mismo diseño sale idéntico por ambas vías. Lo que sobresale de la tarjeta
    se recorta, para no invadir las tarjetas vecinas en una hoja de lote."""
    ancho_mm, alto_mm = dimensiones_mm(definicion)
    ancho_pt = ancho_mm * MM_A_PT
    alto_pt = alto_mm * MM_A_PT
    datos_dict, foto_bytes = _normalizar_datos(datos)
    colores_regla = resolver_color_carnet(definicion, datos_dict)

    sangrado_pt = max(0.0, sangrado_mm) * MM_A_PT

    c.saveState()
    c.translate(x_offset, y_offset)
    recorte = c.beginPath()
    # Con sangrado, la cara se dibuja (y se recorta) un poco más allá del corte final.
    recorte.rect(-sangrado_pt, -sangrado_pt, ancho_pt + 2 * sangrado_pt, alto_pt + 2 * sangrado_pt)
    c.clipPath(recorte, stroke=0, fill=0)

    bg_cfg = definicion.get('bg', {})
    color_fondo = bg_cfg.get(cara, '#ffffff') if isinstance(bg_cfg, dict) else '#ffffff'
    c.setFillColor(_hex_seguro(color_fondo, '#ffffff'))
    c.rect(-sangrado_pt, -sangrado_pt, ancho_pt + 2 * sangrado_pt, alto_pt + 2 * sangrado_pt, fill=1, stroke=0)

    for el in elementos_de_cara(definicion, cara):
        if el.get('oculto') or el.get('hidden'):
            continue
        if sangrado_pt:
            el = _extender_al_sangrado(el, ancho_mm, alto_mm, sangrado_mm)
        _dibujar_elemento(c, el, datos_dict, foto_bytes, colores_regla, ancho_pt, alto_mm)

    c.restoreState()


def generar_carnet_pdf_fiel(
    definicion: dict[str, Any],
    datos: DatosCarnetPdf | dict[str, Any],
    sangrado_mm: float = 0.0,
    marcas_corte: bool = False,
) -> bytes:
    """
    Motor canónico de impresión fiel ReportLab (O44 - E8).
    Interpreta capa por capa la definición geométrica y genera un documento PDF de 2 páginas
    (anverso y reverso) respetando dimensiones milimétricas, fuentes institucionales y reglas de color.

    Formato imprenta (B-3): con `sangrado_mm` y/o `marcas_corte` la página crece para alojar el
    sangrado y las marcas; el PDF declara TrimBox (corte final) y BleedBox (sangrado).
    """
    ancho_mm, alto_mm = dimensiones_mm(definicion)
    datos_dict, _ = _normalizar_datos(datos)
    ancho_pt, alto_pt = ancho_mm * MM_A_PT, alto_mm * MM_A_PT
    sangrado_mm = max(0.0, float(sangrado_mm or 0))
    sangrado_pt = sangrado_mm * MM_A_PT
    margen_pt = MARGEN_MARCAS_MM * MM_A_PT if marcas_corte else 0.0
    desplazamiento = sangrado_pt + margen_pt

    buffer = BytesIO()
    c = canvas.Canvas(
        buffer,
        pagesize=(ancho_pt + 2 * desplazamiento, alto_pt + 2 * desplazamiento),
        pageCompression=0,
    )
    c.setAuthor("GATH - Sistema de Carnetización Institucional")
    nombre_doc = datos_dict.get('nombre_completo', 'Credencial')
    c.setTitle(f"Carnet {nombre_doc}")
    c.setSubject("Credencial Institucional Oficial")

    for idx_cara, cara in enumerate(('anverso', 'reverso')):
        dibujar_cara(c, definicion, datos, cara, desplazamiento, desplazamiento, sangrado_mm)
        if marcas_corte:
            _marcas_corte_individual(c, desplazamiento, desplazamiento, ancho_pt, alto_pt, sangrado_pt, margen_pt)
        if desplazamiento:
            corte = (desplazamiento, desplazamiento, desplazamiento + ancho_pt, desplazamiento + alto_pt)
            c.setTrimBox(corte)
            c.setBleedBox((corte[0] - sangrado_pt, corte[1] - sangrado_pt,
                           corte[2] + sangrado_pt, corte[3] + sangrado_pt))
        if idx_cara == 0:
            c.showPage()

    c.save()
    return buffer.getvalue()


def generar_carnet_pdf(
    datos: DatosCarnetPdf,
    definicion: dict[str, Any] | None = None,
    sangrado_mm: float = 0.0,
    marcas_corte: bool = False,
) -> bytes:
    """
    Función fachada retrocompatible.
    Si se suministra una definición JSON (o se recurre a la plantilla por defecto),
    invoca el motor fiel de 2 caras (O44 - E8).
    Si se solicita la plantilla legada en imagen fija con datos.plantilla_path, conserva
    el renderizado de compatibilidad previa.
    """
    if definicion is not None:
        return generar_carnet_pdf_fiel(definicion, datos, sangrado_mm, marcas_corte)

    # Si hay una imagen fija legada explícita y no hay definición nueva, usar el layout previo
    if datos.plantilla_path and not definicion:
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=(CARNET_WIDTH, CARNET_HEIGHT))
        try:
            c.drawImage(ImageReader(datos.plantilla_path), 0, 0, CARNET_WIDTH, CARNET_HEIGHT, preserveAspectRatio=False, anchor="c")
        except Exception:
            c.rect(0, 0, CARNET_WIDTH, CARNET_HEIGHT, fill=1)

        qr_tamano = 1.2 * cm
        x_qr, y_qr = 0.4 * cm, 0.8 * cm
        _dibujar_qr(c, datos, x_qr, y_qr, tamano=qr_tamano)

        photo_width, photo_height = 2.0 * cm, 2.4 * cm
        x_foto = (CARNET_WIDTH - photo_width) / 2
        y_foto = 4.6 * cm
        _dibujar_foto(c, datos.foto_bytes, x_foto, y_foto, photo_width, photo_height)

        center_x = CARNET_WIDTH / 2
        text_start_y = y_foto - 0.3 * cm
        c.setFont(FUENTE_NEGRITA, 7)
        c.drawCentredString(center_x, text_start_y, datos.nombre_completo.upper()[:30])
        c.setFont(FUENTE, 7)
        c.drawCentredString(center_x, text_start_y - 0.45 * cm, f"C.I: {datos.cedula}")
        c.save()
        return buffer.getvalue()

    # Por defecto en GATH: motor canónico de dos caras de alta fidelidad
    def_canonica = plantilla_defecto_trabajador()
    return generar_carnet_pdf_fiel(def_canonica, datos, sangrado_mm, marcas_corte)
