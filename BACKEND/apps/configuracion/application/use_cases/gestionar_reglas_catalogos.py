"""
Casos de uso para la administración de Reglas de Catálogos (A5).
"""
from __future__ import annotations

from typing import Sequence

from apps.configuracion.domain.ports.repo_reglas_catalogos import RepoReglasCatalogos
from apps.configuracion.domain.reglas_catalogos import (
    CategoriaMotivoItem,
    ReglaMotivo,
    ReglaNomina,
    ReglaParentesco,
    preparar_nuevo_motivo,
    validar_cambio_categoria_motivo,
)


def obtener_todas_las_reglas(
    repo: RepoReglasCatalogos,
) -> dict:
    """Devuelve el conjunto completo de reglas de catálogos para la pantalla de configuración."""
    return {
        'parentescos': repo.listar_parentescos(),
        'categorias_motivo': repo.listar_categorias_motivo(),
        'motivos': repo.listar_motivos(),
        'nominas': repo.listar_nominas(),
    }


def actualizar_parentesco(
    repo: RepoReglasCatalogos,
    parentesco_id: int,
    aplica_familiar: bool,
) -> tuple[ReglaParentesco, ReglaParentesco]:
    """Actualiza la marca aplica_familiar de un parentesco. Devuelve (anterior, actualizado)."""
    anterior = repo.obtener_parentesco(parentesco_id)
    actualizado = repo.actualizar_parentesco(parentesco_id, aplica_familiar)
    return anterior, actualizado


def cambiar_categoria_motivo(
    repo: RepoReglasCatalogos,
    motivo_id: int,
    nueva_categoria_id: int,
) -> tuple[ReglaMotivo, ReglaMotivo]:
    """
    Cambia la categoría de un motivo de movimiento validando:
    - Que no sea motivo reservado del sistema.
    - Que la categoría origen no quede sin motivos disponibles.
    Devuelve (anterior, actualizado).
    """
    motivo_actual = repo.obtener_motivo(motivo_id)
    nueva_categoria = repo.obtener_categoria_motivo(nueva_categoria_id)
    conteo_origen = repo.contar_motivos_en_categoria(motivo_actual.categoria_id)

    validar_cambio_categoria_motivo(motivo_actual, nueva_categoria, conteo_origen)

    actualizado = repo.cambiar_categoria_motivo(motivo_id, nueva_categoria_id)
    return motivo_actual, actualizado


def crear_nuevo_motivo(
    repo: RepoReglasCatalogos,
    movimiento: str,
    categoria_id: int,
) -> ReglaMotivo:
    """Crea un nuevo motivo dentro de una categoría."""
    nombre_limpio, cat_id = preparar_nuevo_motivo(movimiento, categoria_id)
    # Verificar que la categoría exista
    repo.obtener_categoria_motivo(cat_id)
    return repo.crear_motivo(nombre_limpio, cat_id)


def actualizar_nomina(
    repo: RepoReglasCatalogos,
    nomina_id: int,
    es_activo: bool | None,
    requiere_codig: bool | None,
) -> tuple[ReglaNomina, ReglaNomina]:
    """Actualiza marcas es_activo y/o requiere_codig de un tipo de nómina. Devuelve (anterior, actualizado)."""
    anterior = repo.obtener_nomina(nomina_id)
    actualizado = repo.actualizar_nomina(nomina_id, es_activo, requiere_codig)
    return anterior, actualizado
