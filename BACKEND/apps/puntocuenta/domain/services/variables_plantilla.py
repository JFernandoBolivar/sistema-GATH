"""
Servicio de dominio para variables de plantillas de Punto de Cuenta (RN-006-01).
Un único diccionario canónico compartido entre el generador de PDF,
la validación de entrada y la ayuda al usuario en pantalla.
"""
import re
from typing import Mapping

DICCIONARIO_VARIABLES: dict[str, str] = {
    'nombre': 'Nombre completo del trabajador',
    'cedula': 'Cédula de identidad',
    'cargo': 'Denominación del cargo / puesto',
    'origen': 'Gerencia / Oficina de origen',
    'destino': 'Gerencia / Oficina de destino',
    'fecha': 'Fecha del movimiento',
    'motivo': 'Motivo administrativo',
    'numero': 'Número correlativo de punto de cuenta',
}

VARIABLES_PERMITIDAS: frozenset[str] = frozenset(DICCIONARIO_VARIABLES.keys())

_REGEX_VARIABLE = re.compile(r'\{([a-zA-Z0-9_]+)\}')


def extraer_variables(texto: str | None) -> list[str]:
    """Extrae los nombres de variables sin llaves presentes en el texto."""
    if not texto:
        return []
    return _REGEX_VARIABLE.findall(texto)


def validar_variables_texto(texto: str | None) -> list[str]:
    """
    Retorna la lista de variables desconocidas encontradas en el texto.
    Si todas son válidas, retorna lista vacía.
    """
    variables = extraer_variables(texto)
    return [v for v in variables if v not in VARIABLES_PERMITIDAS]


def obtener_ayuda_variables() -> list[dict[str, str]]:
    """Genera la lista estructurada para serializar hacia la interfaz de usuario."""
    return [{'tag': f'{{{k}}}', 'desc': desc} for k, desc in DICCIONARIO_VARIABLES.items()]
