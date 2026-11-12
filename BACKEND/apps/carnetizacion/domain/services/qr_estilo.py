"""
Estilo del QR del carnet (configurable por plantilla, en `props.qr_estilo` del elemento QR).

Dominio puro: normaliza el estilo (sin estilo equivale a «institucional») y valida que
sea legible con un teléfono antes de publicar (contraste WCAG, tamaño del logo y ojos
oscuros sobre fondo claro). El dibujo vive en infraestructura (`qr_institucional`).
"""
import re
from typing import Any

from core.domain.exceptions import ValidationError

PRESETS = ('institucional', 'degradado', 'clasico', 'personalizado')
FORMAS = ('cuadrado', 'redondeado', 'puntos')
PRESET_DEFECTO = 'institucional'

LOGO_PCT_MIN = 15
LOGO_PCT_MAX = 24
CONTRASTE_MINIMO = 4.5

_HEX = re.compile(r'^#[0-9a-fA-F]{6}$')

AZUL_MARINO = '#1B2A4A'
AZUL_LOGO = '#1264AA'
ROJO = '#C8102E'
NEGRO = '#000000'

_BASE: dict[str, dict[str, Any]] = {
    'institucional': {
        'forma_modulos': 'redondeado', 'color_modulos': AZUL_MARINO, 'color_modulos_2': None,
        'color_ojo_marco': AZUL_MARINO, 'color_ojo_centro': ROJO, 'tamano_pct': 23,
    },
    'degradado': {
        'forma_modulos': 'redondeado', 'color_modulos': AZUL_LOGO, 'color_modulos_2': AZUL_MARINO,
        'color_ojo_marco': AZUL_MARINO, 'color_ojo_centro': AZUL_MARINO, 'tamano_pct': 23,
    },
    'clasico': {
        'forma_modulos': 'cuadrado', 'color_modulos': NEGRO, 'color_modulos_2': None,
        'color_ojo_marco': NEGRO, 'color_ojo_centro': NEGRO, 'tamano_pct': 24,
    },
}


def _hex_o_none(valor: Any) -> str | None:
    if isinstance(valor, str) and _HEX.match(valor.strip()):
        return valor.strip().upper()
    return None


def _numero(valor: Any, defecto: float) -> float:
    try:
        return float(valor)
    except (TypeError, ValueError):
        return defecto


def normalizar_estilo(bruto: Any) -> dict[str, Any]:
    """Estilo completo y seguro a partir de lo guardado; lo ausente o inválido cae a los valores del preset."""
    bruto = bruto if isinstance(bruto, dict) else {}
    preset = bruto.get('preset') if bruto.get('preset') in PRESETS else PRESET_DEFECTO
    base = _BASE.get(preset) or _BASE[PRESET_DEFECTO]
    datos = dict(base)
    if preset == 'personalizado':
        # Solo el preset «personalizado» toma forma y colores de lo guardado.
        if bruto.get('forma_modulos') in FORMAS:
            datos['forma_modulos'] = bruto['forma_modulos']
        for clave in ('color_modulos', 'color_ojo_marco', 'color_ojo_centro'):
            datos[clave] = _hex_o_none(bruto.get(clave)) or base[clave]
        datos['color_modulos_2'] = _hex_o_none(bruto.get('color_modulos_2'))
    logo = bruto.get('logo') if isinstance(bruto.get('logo'), dict) else {}
    medio = logo.get('medio_id')
    pct = _numero(logo.get('tamano_pct'), datos['tamano_pct'])
    return {
        'preset': preset,
        **{k: v for k, v in datos.items() if k != 'tamano_pct'},
        'logo': {
            'activo': bool(logo.get('activo', True)),
            'medio_id': str(medio) if medio else None,
            'tamano_pct': int(min(max(round(pct), LOGO_PCT_MIN), LOGO_PCT_MAX)),
        },
    }


def _luminancia(color: str) -> float:
    canales = []
    for i in (1, 3, 5):
        c = int(color[i:i + 2], 16) / 255
        canales.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2]


def contraste_wcag(color_a: str, color_b: str = '#FFFFFF') -> float:
    """Relación de contraste WCAG 2.x entre dos colores `#RRGGBB` (1 a 21)."""
    la, lb = _luminancia(color_a), _luminancia(color_b)
    claro, oscuro = max(la, lb), min(la, lb)
    return (claro + 0.05) / (oscuro + 0.05)


def _problemas_estilo(bruto: Any) -> list[str]:
    if not isinstance(bruto, dict):
        return []
    problemas: list[str] = []
    estilo = normalizar_estilo(bruto)
    if bruto.get('preset') == 'personalizado':
        for clave in ('color_modulos', 'color_modulos_2', 'color_ojo_marco', 'color_ojo_centro'):
            valor = bruto.get(clave)
            if valor not in (None, '') and _hex_o_none(valor) is None:
                problemas.append(f'«{clave}» no es un color válido (use #RRGGBB).')
    colores = [('los módulos', estilo['color_modulos']), ('el segundo color del degradado', estilo['color_modulos_2'])]
    for etiqueta, color in colores:
        if color and contraste_wcag(color) < CONTRASTE_MINIMO:
            problemas.append(
                f'El contraste de {etiqueta} ({color}) con el fondo blanco es {contraste_wcag(color):.1f}:1; '
                f'se exige {CONTRASTE_MINIMO}:1 o más. Elija un color más oscuro.'
            )
    if contraste_wcag(estilo['color_ojo_marco']) < CONTRASTE_MINIMO:
        problemas.append(
            f'El marco de los ojos ({estilo["color_ojo_marco"]}) debe ser oscuro sobre el fondo claro '
            f'(contraste {contraste_wcag(estilo["color_ojo_marco"]):.1f}:1, mínimo {CONTRASTE_MINIMO}:1).'
        )
    if contraste_wcag(estilo['color_ojo_centro']) < CONTRASTE_MINIMO:
        problemas.append(
            f'El centro de los ojos ({estilo["color_ojo_centro"]}) es demasiado claro '
            f'(contraste {contraste_wcag(estilo["color_ojo_centro"]):.1f}:1, mínimo {CONTRASTE_MINIMO}:1).'
        )
    logo = bruto.get('logo')
    if isinstance(logo, dict) and logo.get('activo', True) and _numero(logo.get('tamano_pct'), 0) > LOGO_PCT_MAX:
        problemas.append(f'El logo del QR no puede superar el {LOGO_PCT_MAX} % del ancho del código.')
    return problemas


def validar_estilos_qr(definicion: dict[str, Any] | None) -> None:
    """Lanza ValidationError si algún QR de la plantilla tiene un estilo ilegible."""
    mensajes: list[str] = []
    for cara in ('anverso', 'reverso'):
        for elemento in (definicion or {}).get(cara) or []:
            if not isinstance(elemento, dict) or elemento.get('tipo') != 'qr':
                continue
            props = elemento.get('props')
            estilo = props.get('qr_estilo') if isinstance(props, dict) else None
            mensajes.extend(f'QR del {cara}: {p}' for p in _problemas_estilo(estilo))
    if mensajes:
        raise ValidationError(
            'El estilo del código QR no es legible con un teléfono y no se puede publicar. ' + ' '.join(mensajes)
        )
