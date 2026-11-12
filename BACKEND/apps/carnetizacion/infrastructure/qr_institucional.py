"""QR institucional con el logo de CONATEL al centro, con estilo configurable.

Se usa en el PDF del carnet, en la imagen QR pública y en la vista previa del diseñador.
El nivel de corrección `H` permite tapar una parte del código sin perder legibilidad.

Estilos (`apps.carnetizacion.domain.services.qr_estilo`): «institucional» (predeterminado:
módulos redondeados azul marino, ojos con centro rojo, logo recortado en un halo circular),
«degradado», «personalizado» y «clasico» (negro con el logo sobre un recuadro blanco).

Zona de silencio: `border` módulos (2 por defecto). El carnet ya aporta un margen blanco
alrededor del QR, por eso no se exige la zona de 4 módulos de la norma y se conserva el
valor que ya se usaba; la legibilidad se comprueba con OpenCV en las pruebas.
"""
import math
from io import BytesIO
from typing import Any

import qrcode
import qrcode.constants
from PIL import Image, ImageChops, ImageDraw, ImageOps
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import (
    CircleModuleDrawer,
    RoundedModuleDrawer,
    SquareModuleDrawer,
)

from apps.carnetizacion.domain.services.qr_estilo import normalizar_estilo
from core.infrastructure.pdf.pdf_components import ruta_asset

LOGO_QR = 'logo_conatel.png'

_BOX_RENDER = 16       # px por módulo al dibujar; luego se reduce (suavizado)
_BOX_SALIDA_MIN = 8    # el PNG final no baja de 8 px por módulo (impresión a ~300 ppp)
_RADIO_ZONA = 0.715    # radio de la zona sin módulos = esto × ancho del logo
_DIAMETRO_HALO = 1.32  # diámetro del halo blanco = esto × ancho del logo


def _rgb(color: str) -> tuple[int, int, int]:
    return int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)


def _logo_recortado(origen: Any) -> Image.Image | None:
    """Logo RGBA recortado a su contenido (el PNG de CONATEL trae mucho margen vacío)."""
    try:
        with Image.open(origen) as im:
            logo = im.convert('RGBA')
        caja = logo.split()[3].getbbox()
        return logo.crop(caja) if caja else None
    except Exception:
        # Un logo dañado no debe impedir emitir el carnet: se entrega el QR sin logo.
        return None


def _cargar_logo(logo_bytes: bytes | None) -> Image.Image | None:
    if logo_bytes:
        return _logo_recortado(BytesIO(logo_bytes))
    ruta = ruta_asset(LOGO_QR)
    return _logo_recortado(ruta) if ruta else None


def _plantilla_qr(contenido: str, box: int, border: int) -> qrcode.QRCode:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=box,
        border=border,
    )
    qr.add_data(contenido)
    qr.make(fit=True)
    return qr


def _a_png(imagen: Image.Image) -> bytes:
    buffer = BytesIO()
    imagen.save(buffer, format='PNG')
    return buffer.getvalue()


def _qr_clasico(contenido: str, box_size: int, border: int, logo: Image.Image | None) -> Image.Image:
    """Estilo anterior: negro y cuadrado, con el logo sobre un recuadro blanco (≤ 24 %)."""
    imagen = _plantilla_qr(contenido, box_size, border).make_image(
        fill_color='black', back_color='white',
    ).convert('RGB')
    if logo is not None:
        lado = max(1, int(min(imagen.size) * 0.24))
        fondo = Image.new('RGBA', (lado, lado), (255, 255, 255, 255))
        margen = max(1, int(lado * 0.12))
        disponible = lado - 2 * margen
        logo = logo.copy()
        logo.thumbnail((disponible, disponible), Image.LANCZOS)
        fondo.paste(logo, ((lado - logo.width) // 2, (lado - logo.height) // 2), logo)
        imagen.paste(fondo.convert('RGB'), ((imagen.width - lado) // 2, (imagen.height - lado) // 2))
    return imagen


class _QRConHalo(StyledPilImage):
    """StyledPilImage que omite los módulos de la zona central (donde va el logo)."""

    zona_libre = None  # callable (fila, col) -> bool

    def drawrect_context(self, row, col, qr):
        if self.zona_libre and self.zona_libre(row, col):
            return
        super().drawrect_context(row, col, qr)


def _dibujadores(forma: str):
    if forma == 'cuadrado':
        return SquareModuleDrawer(), SquareModuleDrawer()
    if forma == 'puntos':
        return CircleModuleDrawer(), RoundedModuleDrawer(radius_ratio=1)
    return RoundedModuleDrawer(radius_ratio=1), RoundedModuleDrawer(radius_ratio=1)


def _degradado_diagonal(tam: int, color_a: str, color_b: str) -> Image.Image:
    """Degradado de `color_a` (arriba-izquierda) a `color_b` (abajo-derecha)."""
    horizontal = Image.linear_gradient('L').rotate(-90).resize((tam, tam))  # 0 a la izquierda
    vertical = Image.linear_gradient('L').resize((tam, tam))                # 0 arriba
    t = ImageChops.add(horizontal, vertical, scale=2)
    return Image.composite(
        Image.new('RGB', (tam, tam), _rgb(color_b)), Image.new('RGB', (tam, tam), _rgb(color_a)), t,
    )


def _disco(tam: int, diametro: int) -> Image.Image:
    """Máscara L de un disco centrado con borde suave (supersampling x4)."""
    s = 4
    capa = Image.new('L', (tam * s, tam * s), 0)
    x0 = (tam * s - diametro * s) // 2
    ImageDraw.Draw(capa).ellipse([x0, x0, x0 + diametro * s, x0 + diametro * s], fill=255)
    return capa.resize((tam, tam), Image.LANCZOS)


def _qr_estilizado(
    contenido: str, box_size: int, border: int, estilo: dict[str, Any], logo: Image.Image | None,
) -> Image.Image:
    box = _BOX_RENDER
    qr = _plantilla_qr(contenido, box, border)
    n = qr.modules_count
    total = (n + 2 * border) * box
    ancho_logo = total * estilo['logo']['tamano_pct'] / 100

    if logo is not None:
        radio = ancho_logo * _RADIO_ZONA
        centro = total / 2

        def libre(fila: int, col: int) -> bool:
            cx, cy = (col + border + 0.5) * box, (fila + border + 0.5) * box
            return math.hypot(cx - centro, cy - centro) <= radio

        _QRConHalo.zona_libre = staticmethod(libre)
    else:
        _QRConHalo.zona_libre = None

    modulo, ojo = _dibujadores(estilo['forma_modulos'])
    try:
        base = qr.make_image(image_factory=_QRConHalo, module_drawer=modulo, eye_drawer=ojo)
    finally:
        _QRConHalo.zona_libre = None
    # Máscara de tinta: 255 donde hay módulo.
    tinta = ImageOps.invert(base.get_image().convert('L'))

    # Capa de color: cuerpo (sólido o degradado) + marco de ojos + centro de ojos.
    if estilo['color_modulos_2']:
        color = _degradado_diagonal(total, estilo['color_modulos'], estilo['color_modulos_2'])
    else:
        color = Image.new('RGB', (total, total), _rgb(estilo['color_modulos']))
    marco = Image.new('RGB', (7 * box, 7 * box), _rgb(estilo['color_ojo_marco']))
    centro_ojo = Image.new('RGB', (3 * box, 3 * box), _rgb(estilo['color_ojo_centro']))
    for ox, oy in ((0, 0), (n - 7, 0), (0, n - 7)):
        x0, y0 = (border + ox) * box, (border + oy) * box
        color.paste(marco, (x0, y0))
        color.paste(centro_ojo, (x0 + 2 * box, y0 + 2 * box))
    salida = Image.new('RGB', (total, total), (255, 255, 255))
    salida.paste(color, mask=tinta)

    if logo is not None:
        salida.paste(Image.new('RGB', (total, total), (255, 255, 255)),
                     mask=_disco(total, int(ancho_logo * _DIAMETRO_HALO)))
        escala = ancho_logo / max(logo.size)
        lw, lh = max(1, int(logo.width * escala)), max(1, int(logo.height * escala))
        pequeno = logo.resize((lw, lh), Image.LANCZOS)
        salida.paste(pequeno, ((total - lw) // 2, (total - lh) // 2), pequeno)

    destino = (n + 2 * border) * max(box_size, _BOX_SALIDA_MIN)
    return salida.resize((destino, destino), Image.LANCZOS)


def generar_qr_png(
    contenido: str,
    *,
    box_size: int = 8,
    border: int = 2,
    con_logo: bool = True,
    estilo: dict[str, Any] | None = None,
    logo_bytes: bytes | None = None,
) -> bytes:
    """Devuelve el PNG del QR.

    `estilo` es el `qr_estilo` de la plantilla (sin él, «institucional»). `logo_bytes`
    sustituye al logo de CONATEL (p. ej. uno de la Biblioteca de Medios). Con
    `con_logo=False` (o `estilo.logo.activo` falso) se obtiene el QR sin logo.
    """
    estilo = normalizar_estilo(estilo)
    quiere_logo = con_logo and estilo['logo']['activo']
    logo = _cargar_logo(logo_bytes) if quiere_logo else None
    if quiere_logo and logo is None and logo_bytes:
        # Logo de la biblioteca ilegible: se recurre al de CONATEL antes que a un QR sin logo.
        logo = _cargar_logo(None)
    if estilo['preset'] == 'clasico':
        return _a_png(_qr_clasico(contenido, box_size, border, logo))
    return _a_png(_qr_estilizado(contenido, box_size, border, estilo, logo))


def verificar_lectura_estilos(definicion: dict[str, Any] | None) -> None:
    """Decodifica un QR de prueba por cada estilo de la plantilla (solo si OpenCV está instalado).

    Complementa las reglas de contraste del dominio; sin `cv2` en el servidor no hace nada.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return
    from core.domain.exceptions import ValidationError

    muestra = 'https://gath.conatel.gob.ve/carnet/AbCdEfGhIjKlMnOpQrStUv'
    vistos: set[str] = set()
    for cara in ('anverso', 'reverso'):
        for elemento in (definicion or {}).get(cara) or []:
            if not isinstance(elemento, dict) or elemento.get('tipo') != 'qr':
                continue
            props = elemento.get('props')
            estilo = props.get('qr_estilo') if isinstance(props, dict) else None
            clave = repr(normalizar_estilo(estilo))
            if clave in vistos:
                continue
            vistos.add(clave)
            png = generar_qr_png(muestra, box_size=10, border=2, estilo=estilo)
            imagen = np.array(Image.open(BytesIO(png)).convert('RGB'))[:, :, ::-1].copy()
            texto, _, _ = cv2.QRCodeDetector().detectAndDecode(imagen)
            if texto != muestra:
                raise ValidationError(
                    f'El estilo del código QR del {cara} no se pudo leer en la prueba de lectura. '
                    'Use colores más oscuros, un logo más pequeño o el estilo «Institucional».'
                )
