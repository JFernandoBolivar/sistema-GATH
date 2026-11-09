"""
Categorías de motivo de movimiento: UN solo lugar donde se decide qué categoría
de `RAC_categoria_movimiento` corresponde a cada operación que pide un «Motivo».

Antes cada pantalla filtraba los motivos por texto (p. ej. «contiene fallec»).
Ahora cada operación declara su categoría aquí; los listados, la validación al
ejecutar el movimiento y el alta de motivos nuevos («Otros…») usan este mapa.
Puro: sin Django ni DRF (regla B1).

Mapeo operación -> categoría (clave = `Operacion.value`, la que viaja en
`?operacion=` al listar/crear motivos):

| Operación                | Pantalla / endpoint                                  | Categoría       |
|--------------------------|------------------------------------------------------|-----------------|
| asignar_cargo            | Asignar código a un empleado (cargos/asignar)        | INGRESO         |
| desasignar_cargo         | Desasignar código (cargos/desasignar)                | ESTATUS         |
| cambiar_cargo            | Cambio de cargo / traslado (movimientos, cargos)     | TRASLADO        |
| cambiar_estatus_puesto   | Suspensión / cambio de estatus de un puesto          | ESTATUS         |
| prestamo_cargo           | Encargaduría / préstamo de cargo                     | ENCARGADURIA    |
| pase_a_pasivo            | Pase a pasivo (movimientos/cambiar-pasivo)           | PASE A PASIVO   |
| egreso_activo            | Egreso de personal ACTIVO (gestión de personal)      | EGRESO          |
| egreso_pasivo            | Egreso de personal PASIVO (pasivos/egreso)           | EGRESO PASIVO   |
| cambiar_estatus_pasivo   | Cambio de estatus de un pasivo (sin pantalla aún)    | ESTATUS PASIVO  |

Los nombres de categoría respetan el máximo de 20 caracteres de la columna.
"""
from __future__ import annotations

from enum import Enum

from core.domain.exceptions import ValidationError

LONGITUD_MIN_MOTIVO = 3
LONGITUD_MAX_MOTIVO = 100
LONGITUD_MAX_CATEGORIA = 20


class CategoriaMotivo(str, Enum):
    """Valores EXACTOS (en mayúsculas) de `RAC_categoria_movimiento.categoria`."""

    INGRESO = 'INGRESO'
    TRASLADO = 'TRASLADO'
    EGRESO = 'EGRESO'
    ENCARGADURIA = 'ENCARGADURIA'
    ESTATUS = 'ESTATUS'
    ESTATUS_PASIVO = 'ESTATUS PASIVO'
    PASE_A_PASIVO = 'PASE A PASIVO'
    EGRESO_PASIVO = 'EGRESO PASIVO'


class Operacion(str, Enum):
    ASIGNAR_CARGO = 'asignar_cargo'
    DESASIGNAR_CARGO = 'desasignar_cargo'
    CAMBIAR_CARGO = 'cambiar_cargo'
    CAMBIAR_ESTATUS_PUESTO = 'cambiar_estatus_puesto'
    PRESTAMO_CARGO = 'prestamo_cargo'
    PASE_A_PASIVO = 'pase_a_pasivo'
    EGRESO_ACTIVO = 'egreso_activo'
    EGRESO_PASIVO = 'egreso_pasivo'
    CAMBIAR_ESTATUS_PASIVO = 'cambiar_estatus_pasivo'


CATEGORIA_POR_OPERACION: dict[Operacion, CategoriaMotivo] = {
    Operacion.ASIGNAR_CARGO: CategoriaMotivo.INGRESO,
    Operacion.DESASIGNAR_CARGO: CategoriaMotivo.ESTATUS,
    Operacion.CAMBIAR_CARGO: CategoriaMotivo.TRASLADO,
    Operacion.CAMBIAR_ESTATUS_PUESTO: CategoriaMotivo.ESTATUS,
    Operacion.PRESTAMO_CARGO: CategoriaMotivo.ENCARGADURIA,
    Operacion.PASE_A_PASIVO: CategoriaMotivo.PASE_A_PASIVO,
    Operacion.EGRESO_ACTIVO: CategoriaMotivo.EGRESO,
    Operacion.EGRESO_PASIVO: CategoriaMotivo.EGRESO_PASIVO,
    Operacion.CAMBIAR_ESTATUS_PASIVO: CategoriaMotivo.ESTATUS_PASIVO,
}

# Categorías con las que se reconoce que el titular murió (alta de sobrevivientes).
# «FALLECIMIENTO» es la categoría dedicada del legado, si existe en la BD.
CATEGORIAS_FALLECIMIENTO: frozenset[str] = frozenset({CategoriaMotivo.EGRESO_PASIVO.value, 'FALLECIMIENTO'})

# Motivos que el sistema asigna solo (no los elige el usuario). Se buscan por nombre
# exacto dentro de la categoría PASE A PASIVO (D13); una migración de datos garantiza
# que existan y que no queden copias en INGRESO.
MOTIVO_SISTEMA_JUBILACION = 'JUBILACION DE DERECHO'
MOTIVO_SISTEMA_JUBILACION_ORDINARIA = 'JUBILACION ORDINARIA'
MOTIVO_SISTEMA_JUBILACION_ESPECIAL = 'JUBILACION ESPECIAL'
MOTIVO_SISTEMA_PENSION_INVALIDEZ = 'PENSION DE INVALIDEZ'
MOTIVO_SISTEMA_PENSION_SOBREVIVIENTE = 'PENSION POR SOBREVIVIENTE'


def operacion_de(valor: str | Operacion | None) -> Operacion:
    """Convierte el texto recibido en `?operacion=` a `Operacion`; error por campo si es desconocida."""
    if isinstance(valor, Operacion):
        return valor
    try:
        return Operacion((valor or '').strip().lower())
    except ValueError:
        raise ValidationError('La operación indicada no es válida.', campo='operacion') from None


def categoria_de(operacion: str | Operacion) -> CategoriaMotivo:
    return CATEGORIA_POR_OPERACION[operacion_de(operacion)]


def categoria_conocida(valor: str | None) -> CategoriaMotivo:
    """Valida un nombre de categoría recibido por HTTP contra el catálogo cerrado."""
    texto = (valor or '').strip().upper()
    for categoria in CategoriaMotivo:
        if categoria.value == texto:
            return categoria
    raise ValidationError('La categoría indicada no es válida.', campo='categoria')


def normalizar_nombre_motivo(nombre: str | None, campo: str = 'movimiento') -> str:
    """Nombre de un motivo nuevo: 3–100 caracteres, sin marcado HTML. Devuelve el texto en mayúsculas."""
    texto = ' '.join((nombre or '').split())
    if len(texto) < LONGITUD_MIN_MOTIVO:
        raise ValidationError(f'El motivo debe tener al menos {LONGITUD_MIN_MOTIVO} caracteres.', campo=campo)
    if len(texto) > LONGITUD_MAX_MOTIVO:
        raise ValidationError(f'El motivo no puede superar {LONGITUD_MAX_MOTIVO} caracteres.', campo=campo)
    if '<' in texto or '>' in texto:
        raise ValidationError('El motivo no puede contener «<» ni «>».', campo=campo)
    return texto.upper()


def validar_motivo_de_operacion(
    categoria_del_motivo: str | None,
    operacion: str | Operacion,
    campo: str = 'motivo_id',
) -> None:
    """El motivo elegido debe pertenecer a la categoría de la operación (sin mirar su texto)."""
    esperada = categoria_de(operacion)
    actual = (categoria_del_motivo or '').strip().upper()
    if actual != esperada.value:
        raise ValidationError(
            f'El motivo seleccionado no corresponde a esta operación (se requiere un motivo de la categoría «{esperada.value}»).',
            campo=campo,
        )
