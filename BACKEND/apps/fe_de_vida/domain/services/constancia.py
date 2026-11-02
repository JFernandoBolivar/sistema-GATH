"""Reglas puras de la constancia: numeración, código de verificación y texto. Sin Django."""
import hashlib
import re
import secrets
from datetime import datetime

from apps.fe_de_vida.domain.entities.constancia import PlantillaConstancia
from apps.fe_de_vida.domain.entities.pasivo import DatosPasivo

PREFIJO_NUMERO = 'FV'
DIGITOS_CORRELATIVO = 6


def formatear_numero(anio: int, correlativo: int) -> str:
    """FV-AAAA-NNNNNN."""
    return f'{PREFIJO_NUMERO}-{anio}-{correlativo:0{DIGITOS_CORRELATIVO}d}'


def prefijo_anual(anio: int) -> str:
    return f'{PREFIJO_NUMERO}-{anio}-'


def correlativo_de(numero: str) -> int:
    """Parte numérica de un número de constancia (0 si no respeta el formato)."""
    try:
        return int(numero.rsplit('-', 1)[1])
    except (IndexError, ValueError):
        return 0


def generar_codigo_verificacion(numero: str, solicitud_id: str, cedula: str) -> str:
    """Hash SHA-256 con sal aleatoria: identifica la constancia y no se puede adivinar."""
    material = f'{numero}|{solicitud_id}|{cedula}|{secrets.token_hex(16)}'
    return hashlib.sha256(material.encode()).hexdigest()


def texto_constancia(plantilla: PlantillaConstancia, pasivo: DatosPasivo, fecha: datetime) -> str:
    """Sustituye solo los marcadores conocidos (una plantilla editable no puede ejecutar nada más)."""
    valores = {
        'fecha': fecha.strftime('%d/%m/%Y'), 'nombre_completo': pasivo.nombre_completo, 'cedula': pasivo.cedula,
        'condicion': pasivo.condicion.lower(),
    }
    return re.sub(r'\{(\w+)\}', lambda m: valores.get(m.group(1), m.group(0)), plantilla.texto)
