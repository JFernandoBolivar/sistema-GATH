"""
Dominio de Reglas de Catálogos (A5).

Gobierna las marcas y reglas del sistema sobre tablas maestras:
1. Parentescos: aplica_familiar (Permitido para familiares).
2. Motivos de movimiento: asignación a categorías (INGRESO, TRASLADO, EGRESO, etc.),
   protegiendo las categorías requeridas del sistema y los motivos reservados.
3. Tipos de nómina: es_activo (Nómina activa) y requiere_codig (Requiere código).

Puro: sin Django ni DRF (regla B1).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from core.domain.categorias_motivo import (
    CategoriaMotivo,
    MOTIVO_SISTEMA_JUBILACION,
    MOTIVO_SISTEMA_PENSION_INVALIDEZ,
    MOTIVO_SISTEMA_PENSION_SOBREVIVIENTE,
    normalizar_nombre_motivo,
)
from core.domain.exceptions import ValidationError

MODULO_AUDITORIA_CONFIGURACION = 'configuracion'
RECURSO_REGLAS_PARENTESCO = 'regla_parentesco'
RECURSO_REGLAS_MOTIVO = 'regla_motivo_movimiento'
RECURSO_REGLAS_NOMINA = 'regla_tipo_nomina'

ACCION_PARENTESCO_ACTUALIZADO = 'PARENTESCO_ACTUALIZADO'
ACCION_MOTIVO_CATEGORIA_CAMBIADA = 'MOTIVO_CATEGORIA_CAMBIADA'
ACCION_MOTIVO_CREADO = 'MOTIVO_MOVIMIENTO_CREADO'
ACCION_NOMINA_ACTUALIZADA = 'TIPO_NOMINA_ACTUALIZADA'

# Motivos del sistema que no se pueden mover ni renombrar
MOTIVOS_SISTEMA_RESERVADOS: frozenset[str] = frozenset({
    MOTIVO_SISTEMA_JUBILACION.upper(),
    MOTIVO_SISTEMA_PENSION_INVALIDEZ.upper(),
    MOTIVO_SISTEMA_PENSION_SOBREVIVIENTE.upper(),
})


@dataclass(frozen=True)
class ReglaParentesco:
    id: int
    descripcion: str
    aplica_familiar: bool


@dataclass(frozen=True)
class CategoriaMotivoItem:
    id: int
    categoria: str


@dataclass(frozen=True)
class ReglaMotivo:
    id: int
    movimiento: str
    categoria_id: int
    categoria_nombre: str
    es_reservado: bool


@dataclass(frozen=True)
class ReglaNomina:
    id: int
    nomina: str
    requiere_codig: bool
    es_activo: bool


def es_motivo_reservado(nombre_movimiento: str, categoria_nombre: str) -> bool:
    """Un motivo es reservado si tiene el nombre exacto de un motivo del sistema en PASE A PASIVO."""
    nom = (nombre_movimiento or '').strip().upper()
    cat = (categoria_nombre or '').strip().upper()
    return cat == CategoriaMotivo.PASE_A_PASIVO.value and nom in MOTIVOS_SISTEMA_RESERVADOS


def validar_cambio_categoria_motivo(
    motivo_actual: ReglaMotivo,
    nueva_categoria: CategoriaMotivoItem,
    conteo_motivos_en_categoria_origen: int,
) -> None:
    """
    Reglas de negocio:
    1. Bloquear mover los motivos que el sistema asigna solo (MOTIVO_SISTEMA_* en PASE A PASIVO).
    2. Bloquear dejar sin motivos una categoría que el sistema necesita.
    """
    if motivo_actual.categoria_id == nueva_categoria.id:
        return

    # 1. Protección de motivos reservados del sistema
    if es_motivo_reservado(motivo_actual.movimiento, motivo_actual.categoria_nombre):
        raise ValidationError(
            f'El motivo «{motivo_actual.movimiento}» es un motivo reservado del sistema '
            'para el pase a condición de pasivo y no puede ser reasignado a otra categoría.',
            campo='categoria_id',
        )

    # 2. Bloquear dejar sin motivos una categoría del sistema
    nombres_categorias_sistema = {c.value for c in CategoriaMotivo}
    if (
        motivo_actual.categoria_nombre.upper() in nombres_categorias_sistema
        and conteo_motivos_en_categoria_origen <= 1
    ):
        raise ValidationError(
            f'No es posible transferir este motivo porque la categoría '
            f'«{motivo_actual.categoria_nombre}» es requerida por el sistema '
            'y quedaría sin ningún motivo disponible.',
            campo='categoria_id',
        )


def preparar_nuevo_motivo(movimiento: str, categoria_id: int) -> tuple[str, int]:
    """Valida y normaliza el texto y la categoría para dar de alta un motivo nuevo."""
    if not categoria_id:
        raise ValidationError('Debe indicar la categoría a la que pertenecerá el motivo.', campo='categoria_id')
    nombre_limpio = normalizar_nombre_motivo(movimiento, campo='movimiento')
    return nombre_limpio, categoria_id
