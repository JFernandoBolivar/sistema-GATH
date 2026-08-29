"""
Gestión del código de asignación de trabajo (`AsigTrabajo.codigo`), gap #5
de la migración funcional de personal/activo.

Módulo puro (sin Django, sin ORM — regla B1): réplica exacta de la parte
SIN acceso a datos de `RAC/services/generacion_codigo.py`. La parte con
acceso a datos (buscar el último código usado con determinado prefijo)
vive en el repositorio (`RepoCargosORM`, regla D-09) y se inyecta aquí como
argumento simple (lista de códigos existentes), no como querysets.
"""
from enum import Enum


class TipoCodigoAsignacion(str, Enum):
    """
    Los dos esquemas de código que usa `AsigTrabajo.codigo`:
      - NORMAL: 8 dígitos (6 de ubicación + 2 de tipo de cargo), generado
        por `generar_codigo_normal`.
      - ESPECIAL: prefijo de nómina + correlativo de 4 dígitos (p.ej.
        "CS_0001", "HP_0001"), generado por `generar_codigo_especial`.
    """
    NORMAL = 'normal'
    ESPECIAL = 'especial'


_STOP_WORDS = {'DE', 'LA', 'EL', 'Y', 'LOS', 'LAS', 'EN', 'PARA'}

# Reglas de sufijo según palabras clave en el nombre del cargo (UPPERCASE).
# El orden importa: se evalúa de mayor a menor especificidad (más palabras
# clave = más específico). Cargos no clasificados reciben sufijo base 04.
_CARGO_KEYWORDS = [
    (1, frozenset(['DIRECTOR', 'GENERAL'])),
    (1, frozenset(['DIRECTOR'])),
    (1, frozenset(['AUDITOR'])),
    (1, frozenset(['JEFE'])),
    (2, frozenset(['JEFE', 'DIVISION'])),
    (3, frozenset(['COORDINADOR'])),
]
_CARGO_KEYWORDS_SORTED = sorted(_CARGO_KEYWORDS, key=lambda r: len(r[1]), reverse=True)


def generar_prefijo_nomina(nombre_nomina: str) -> str:
    """
    Genera el prefijo de código especial a partir del nombre de la nómina
    (p.ej. "COMISION DE SERVICIO" -> "CS_", "HONORARIOS PROFESIONALES" -> "HP_").
    """
    nombre = (nombre_nomina or '').upper()
    palabras = [w for w in nombre.split() if w not in _STOP_WORDS]
    if not palabras:
        raise ValueError('No se pudo generar un prefijo desde el nombre de la nómina.')
    return ''.join(w[0] for w in palabras) + '_'


def siguiente_codigo_especial(prefijo: str, ultimo_codigo: str | None) -> str:
    """
    Dado el último código existente con `prefijo` (o `None` si no hay
    ninguno), calcula el siguiente correlativo de 4 dígitos.
    """
    if not ultimo_codigo:
        siguiente_numero = 1
    else:
        try:
            siguiente_numero = int(ultimo_codigo[len(prefijo):]) + 1
        except (ValueError, IndexError):
            siguiente_numero = 1
    return f"{prefijo}{str(siguiente_numero).zfill(4)}"


def _sufijo_base_por_cargo(nombre_cargo: str) -> int:
    palabras_cargo = set((nombre_cargo or '').upper().split())
    for sufijo, keywords in _CARGO_KEYWORDS_SORTED:
        if keywords.issubset(palabras_cargo):
            return sufijo
    return 4


def _resolver_prefijo_ubicacion(codigo_coordinacion, codigo_direccion_linea, codigo_direccion_general, codigo_dependencia) -> str:
    for codigo in (codigo_coordinacion, codigo_direccion_linea, codigo_direccion_general, codigo_dependencia):
        if codigo:
            return codigo[:6].zfill(6)
    raise ValueError(
        'No se puede determinar la ubicación del trabajador para generar el código. '
        'Asegúrese de asignar al menos una Dirección General.'
    )


def generar_codigo_normal(
    codigo_coordinacion: str | None,
    codigo_direccion_linea: str | None,
    codigo_direccion_general: str | None,
    codigo_dependencia: str | None,
    nombre_cargo: str,
    sufijos_ya_usados_en_ubicacion: set[int],
) -> str:
    """
    Genera un código de 8 dígitos para un `AsigTrabajo` nuevo o reubicado:
    posiciones 1-6 = unidad organizacional más específica
    (Coordinación > DirecciónLínea > DirecciónGeneral > Dependencia);
    posiciones 7-8 = tipo de cargo por palabras clave, con correlativo si
    el sufijo ya está ocupado en esa ubicación.
    """
    prefijo_6 = _resolver_prefijo_ubicacion(
        codigo_coordinacion, codigo_direccion_linea, codigo_direccion_general, codigo_dependencia,
    )
    sufijo = _sufijo_base_por_cargo(nombre_cargo)
    while sufijo in sufijos_ya_usados_en_ubicacion:
        sufijo += 1
    if sufijo > 99:
        raise ValueError(
            f"No quedan sufijos disponibles en la ubicación {prefijo_6} para el cargo '{nombre_cargo}'."
        )
    return f"{prefijo_6}{str(sufijo).zfill(2)}"
