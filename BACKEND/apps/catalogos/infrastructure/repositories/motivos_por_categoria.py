"""
Motivos de movimiento por CATEGORÍA (sin filtrar por texto).

Adaptador ORM del mapa `core.domain.categorias_motivo` (operación -> categoría):
lista los motivos de una operación, valida que un motivo pertenezca a ella y
crea motivos nuevos («Otros…») dentro de su categoría. Lo usan los repositorios
de cargos, pasivos y la vista de catálogos.
"""
from __future__ import annotations

from django.db import transaction
from django.db.models import Q

from apps.catalogos.infrastructure.models.catalogo_models import CategoriaMovimientoModel, TipoMovimientoModel
from core.domain.categorias_motivo import (
    CategoriaMotivo,
    categoria_de,
    normalizar_nombre_motivo,
    validar_motivo_de_operacion,
)
from core.domain.exceptions import NotFoundError, ValidationError


def obtener_o_crear_categoria(categoria: CategoriaMotivo) -> CategoriaMovimientoModel:
    existente = CategoriaMovimientoModel.objects.filter(categoria__iexact=categoria.value).first()
    if existente is not None:
        return existente
    return CategoriaMovimientoModel.objects.create(categoria=categoria.value)


def listar_motivos_de_categoria(
    categoria: CategoriaMotivo, solo_activos: bool = True
) -> list[TipoMovimientoModel]:
    qs = (
        TipoMovimientoModel.objects.select_related('categoria')
        .filter(categoria__categoria__iexact=categoria.value)
    )
    if solo_activos:
        qs = qs.filter(activo=True)
    # Deduplicación por nombre normalizado (conserva el primer id en orden de PK)
    vistos: set[str] = set()
    resultado: list[TipoMovimientoModel] = []
    for m in qs.order_by('movimiento', 'pk'):
        norm = (m.movimiento or '').strip().upper()
        if norm not in vistos:
            vistos.add(norm)
            resultado.append(m)
    return resultado


def listar_motivos_de_operacion(operacion) -> list[dict]:
    return [
        {'id': motivo.pk, 'nombre': motivo.movimiento}
        for motivo in listar_motivos_de_categoria(categoria_de(operacion))
    ]


def obtener_motivo_de_operacion(motivo_id: int, operacion, campo: str = 'motivo_id') -> TipoMovimientoModel:
    """Motivo existente y de la categoría de la operación; si no, error asociado al campo del formulario."""
    motivo = TipoMovimientoModel.objects.select_related('categoria').filter(pk=motivo_id).first()
    if motivo is None:
        raise NotFoundError(f'Motivo de movimiento {motivo_id} no encontrado.')
    validar_motivo_de_operacion(motivo.categoria.categoria if motivo.categoria_id else None, operacion, campo)
    return motivo


def validar_motivo_opcional(motivo_id: int | None, operacion, campo: str = 'motivo_id') -> None:
    if motivo_id:
        obtener_motivo_de_operacion(motivo_id, operacion, campo)


def obtener_motivo_de_sistema(nombre: str) -> TipoMovimientoModel | None:
    """Motivo que el sistema asigna solo (nombre exacto) dentro de PASE A PASIVO.

    D13: estos motivos (jubilación, pensión de invalidez y pensión por
    sobreviviente) son de pase a pasivo, no de ingreso.
    """
    return (
        TipoMovimientoModel.objects.filter(
            movimiento__iexact=nombre,
            categoria__categoria__iexact=CategoriaMotivo.PASE_A_PASIVO.value,
        )
        .order_by('pk')
        .first()
    )


@transaction.atomic
def crear_motivo_en_categoria(nombre: str | None, categoria: CategoriaMotivo, campo: str = 'movimiento') -> TipoMovimientoModel:
    """Crea un motivo nuevo: 3–100 caracteres, sin duplicados (sin distinguir mayúsculas) en la categoría."""
    texto = normalizar_nombre_motivo(nombre, campo)
    categoria_obj = obtener_o_crear_categoria(categoria)
    if TipoMovimientoModel.objects.filter(
        Q(movimiento__iexact=texto), categoria=categoria_obj,
    ).exists():
        raise ValidationError(f'Ya existe un motivo «{texto}» en la categoría {categoria.value}.', campo=campo)
    return TipoMovimientoModel.objects.create(movimiento=texto, categoria=categoria_obj)
