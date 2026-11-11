"""
Regla de QR legible con teléfono (SILOG): al publicar una plantilla debe existir
al menos un elemento QR, en cualquier cara, de N × N mm o más. Las medidas de los
elementos de la definición ya están en mm.
"""
from typing import Any

from core.domain.exceptions import ValidationError


def _como_numero(valor: Any) -> float:
    try:
        return max(float(valor), 0.0)
    except (TypeError, ValueError):
        return 0.0


def qr_mas_grande(definicion: dict[str, Any] | None) -> tuple[float, float] | None:
    """Ancho y alto del QR con mayor lado útil (el menor de sus lados); None si no hay QR."""
    mejor: tuple[float, float] | None = None
    for cara in ('anverso', 'reverso'):
        for elemento in (definicion or {}).get(cara) or []:
            if not isinstance(elemento, dict) or elemento.get('tipo') != 'qr':
                continue
            medidas = (_como_numero(elemento.get('w')), _como_numero(elemento.get('h')))
            if mejor is None or min(medidas) > min(mejor):
                mejor = medidas
    return mejor


def _formato(valor: float) -> str:
    return f'{valor:.1f}'.rstrip('0').rstrip('.')


def validar_qr_legible(definicion: dict[str, Any] | None, minimo_mm: int) -> None:
    """Lanza ValidationError si ningún QR mide al menos `minimo_mm` × `minimo_mm`."""
    mayor = qr_mas_grande(definicion)
    if mayor is not None and min(mayor) >= minimo_mm:
        return
    medida = f'{_formato(mayor[0])} × {_formato(mayor[1])}' if mayor else '0 × 0'
    raise ValidationError(
        f'La plantilla debe tener al menos un código QR de {minimo_mm} × {minimo_mm} mm o más '
        f'para que pueda leerse con un teléfono (SILOG). El QR más grande mide {medida} mm.'
    )
