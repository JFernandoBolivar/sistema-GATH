"""QR institucional con el logo de CONATEL al centro.

Se usa tanto en el PDF del carnet como en el endpoint público de la imagen QR.
El nivel de corrección `H` permite tapar una parte del código sin perder
legibilidad; el logo se coloca sobre un recuadro blanco para separar los
módulos.
"""
from io import BytesIO

import qrcode
import qrcode.constants
from PIL import Image

from core.infrastructure.pdf.pdf_components import ruta_asset

LOGO_QR = 'logo_conatel.png'


def generar_qr_png(
    contenido: str,
    *,
    box_size: int = 8,
    border: int = 2,
    con_logo: bool = True,
) -> bytes:
    """Devuelve el PNG del QR; con `con_logo=False` se obtiene el QR limpio."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=box_size,
        border=border,
    )
    qr.add_data(contenido)
    qr.make(fit=True)
    imagen = qr.make_image(fill_color='black', back_color='white').convert('RGB')

    ruta_logo = ruta_asset(LOGO_QR) if con_logo else None
    if ruta_logo:
        try:
            with Image.open(ruta_logo) as logo:
                logo = logo.convert('RGBA')
                lado = max(1, int(min(imagen.size) * 0.24))
                fondo = Image.new('RGBA', (lado, lado), (255, 255, 255, 255))
                margen = max(1, int(lado * 0.12))
                disponible = lado - 2 * margen
                logo.thumbnail((disponible, disponible), Image.LANCZOS)
                posicion = (
                    (lado - logo.width) // 2,
                    (lado - logo.height) // 2,
                )
                fondo.paste(logo, posicion, logo)
                imagen.paste(
                    fondo.convert('RGB'),
                    ((imagen.width - lado) // 2, (imagen.height - lado) // 2),
                )
        except Exception:
            # Un logo dañado no debe impedir emitir el carnet: se entrega el QR limpio.
            pass

    buffer = BytesIO()
    imagen.save(buffer, format='PNG')
    return buffer.getvalue()
