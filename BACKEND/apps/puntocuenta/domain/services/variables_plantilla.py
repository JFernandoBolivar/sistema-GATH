"""
Servicio de dominio para variables de plantillas de Punto de Cuenta (RN-006-01, O31).
Un único diccionario canónico compartido entre el generador de PDF,
la validación de entrada y la ayuda al usuario en pantalla.
"""
from datetime import date, datetime
import re
from typing import Mapping

MESES_ES = (
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
)


def formatear_fecha_larga(fecha: str | datetime | date | None) -> str:
    """
    Formatea una fecha al estándar formal de la Administración Pública venezolana:
    Ejemplo: '5 de noviembre de 2026'.
    """
    if not fecha:
        dt = datetime.now()
    elif isinstance(fecha, (datetime, date)):
        dt = fecha
    else:
        str_val = str(fecha).strip()
        dt = None
        for fmt in ('%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%d/%m/%Y', '%d-%m-%Y'):
            try:
                dt = datetime.strptime(str_val[:19], fmt)
                break
            except ValueError:
                continue
        if dt is None:
            dt = datetime.now()

    dia = dt.day
    mes = MESES_ES[dt.month - 1]
    anio = dt.year
    return f"{dia} de {mes} de {anio}"


DICCIONARIO_VARIABLES: dict[str, str] = {
    'numero': 'Número correlativo de punto de cuenta',
    'fecha': 'Fecha del movimiento (DD/MM/AAAA)',
    'fecha_larga': 'Fecha formal en texto largo (ej. 5 de noviembre de 2026)',
    'nombre': 'Nombre completo del trabajador',
    'cedula': 'Cédula de identidad',
    'cargo': 'Denominación del cargo / puesto actual',
    'cargo_destino': 'Denominación del cargo de destino',
    'codigo_cargo': 'Código del cargo',
    'nivel': 'Nivel jerárquico o dependencia',
    'tipo_personal': 'Tipo de personal (fijo, contratado, etc.)',
    'origen': 'Gerencia / Oficina de origen',
    'destino': 'Gerencia / Oficina de destino',
    'motivo': 'Motivo administrativo',
    'fecha_efectiva': 'Fecha efectiva del movimiento',
    'fecha_ingreso': 'Fecha de ingreso a la institución',
    'anios_servicio': 'Años de servicio en la institución',
    'presentado_a': 'Nombre de la autoridad a quien se presenta',
    'cargo_presentado_a': 'Cargo de la autoridad a quien se presenta',
    'presentado_por': 'Nombre del proponente o responsable de unidad',
    'cargo_presentado_por': 'Cargo del proponente',
    'unidad': 'Unidad u oficina remitente',
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

