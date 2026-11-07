"""Reglas puras del cambio de condición al cargar personal (FIX-CARGA1).

La carga declara la población a la que pertenece el archivo. Si un trabajador
existe y su condición actual (ACTIVO/PASIVO, derivada de sus asignaciones) no
coincide con esa población, la fila no es un error: necesita confirmación
explícita y un movimiento laboral con motivo y fecha reales.

Este módulo no importa Django: lo consumen el analizador (infrastructure), la
vista de confirmación y las pruebas unitarias.
"""
from dataclasses import dataclass, field
from enum import Enum


class Poblacion(str, Enum):
    ACTIVOS = 'ACTIVOS'
    PASIVOS = 'PASIVOS'


class DireccionCambio(str, Enum):
    ACTIVO_A_PASIVO = 'ACTIVO_A_PASIVO'
    PASIVO_A_ACTIVO = 'PASIVO_A_ACTIVO'


# Campos que debe traer la fila que origina cada movimiento. Las claves son las
# mismas del registro de campos (`registro_campos.py`).
CAMPOS_REQUERIDOS_POR_DIRECCION: dict[str, tuple[str, ...]] = {
    DireccionCambio.ACTIVO_A_PASIVO.value: ('fecha_egreso', 'motivo_id', 'tipo_nomina_id'),
    DireccionCambio.PASIVO_A_ACTIVO.value: ('fecha_ingreso', 'motivo_id'),
}


def normalizar_poblacion(valor: str | Poblacion | None) -> Poblacion:
    """Convierte el texto de la petición en Poblacion; error de valor si no es válido."""
    if isinstance(valor, Poblacion):
        return valor
    try:
        return Poblacion(str(valor or '').strip().upper())
    except ValueError as exc:
        raise ValueError('La población debe ser «ACTIVOS» o «PASIVOS».') from exc


def direccion_cambio(condicion_actual: str | None, poblacion: str | Poblacion) -> DireccionCambio | None:
    """Dirección del movimiento necesario, o None si la condición ya coincide.

    SIN_ASIGNACION no se considera un cambio de condición: es un trabajador sin
    historial laboral y lo resuelve la validación normal de la fila.
    """
    actual = str(condicion_actual or '').strip().upper()
    destino = normalizar_poblacion(poblacion)
    if actual == destino.value:
        return None
    if actual == 'ACTIVO' and destino is Poblacion.PASIVOS:
        return DireccionCambio.ACTIVO_A_PASIVO
    if actual == 'PASIVO' and destino is Poblacion.ACTIVOS:
        return DireccionCambio.PASIVO_A_ACTIVO
    return None


def requiere_confirmacion(condicion_actual: str | None, poblacion: str | Poblacion) -> bool:
    return direccion_cambio(condicion_actual, poblacion) is not None


def campos_faltantes(direccion: str, valores: dict) -> tuple[str, ...]:
    """Campos obligatorios del movimiento que la fila no trae o no resuelve."""
    requeridos = CAMPOS_REQUERIDOS_POR_DIRECCION.get(str(direccion), ())
    return tuple(clave for clave in requeridos if not valores.get(clave))


def puede_confirmarse(estado: str, movimiento: dict | None) -> tuple[bool, str]:
    """Una fila solo se confirma si es de cambio de condición y su movimiento está completo."""
    if str(estado) != 'REQUIERE_CONFIRMACION':
        return False, 'La fila no requiere confirmación.'
    if not movimiento:
        return False, 'La fila no tiene datos de movimiento para confirmar.'
    if not movimiento.get('completo'):
        faltantes = ', '.join(movimiento.get('faltantes') or ())
        return False, f'Complete los datos del movimiento: {faltantes}.'
    return True, ''


def puede_aplicarse(estado: str, confirmada: bool) -> bool:
    """Sin confirmación explícita, una fila de cambio de condición no se aplica."""
    if str(estado) == 'REQUIERE_CONFIRMACION':
        return bool(confirmada)
    return str(estado) not in ('ERROR', 'SIN_CAMBIOS')


@dataclass(frozen=True)
class ResumenMovimiento:
    """Resumen legible que muestran el diálogo de confirmación y el aprobador."""

    direccion: str
    condicion_actual: str
    condicion_nueva: str
    fecha: str
    motivo: str
    motivo_id: int | None = None
    tipo_nomina: str = ''
    tipo_nomina_id: int | None = None
    cargo_codigo: str = ''
    cargo_id: int | None = None
    descripcion: str = ''
    faltantes: tuple[str, ...] = field(default_factory=tuple)

    @property
    def completo(self) -> bool:
        return not self.faltantes

    def a_dict(self) -> dict:
        return {
            'tipo': self.direccion,
            'condicion_actual': self.condicion_actual,
            'condicion_nueva': self.condicion_nueva,
            'fecha': self.fecha,
            'motivo': self.motivo,
            'motivo_id': self.motivo_id,
            'tipo_nomina': self.tipo_nomina,
            'tipo_nomina_id': self.tipo_nomina_id,
            'cargo_codigo': self.cargo_codigo,
            'cargo_id': self.cargo_id,
            'descripcion': self.descripcion,
            'faltantes': list(self.faltantes),
            'completo': self.completo,
        }
