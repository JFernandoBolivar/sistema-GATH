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
    preparar_nueva_nomina,
    preparar_nuevo_motivo,
    preparar_nuevo_parentesco,
    validar_cambio_categoria_motivo,
    validar_edicion_motivo,
    validar_activacion_nomina,
    validar_edicion_nomina,
    validar_edicion_parentesco,
    validar_eliminacion_motivo,
    validar_eliminacion_nomina,
    validar_eliminacion_parentesco,
    normalizar_nombre_catalogo,
    LARGO_MAXIMO_NOMINA,
    LARGO_MAXIMO_PARENTESCO,
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


def actualizar_motivo(
    repo: RepoReglasCatalogos,
    motivo_id: int,
    movimiento: str | None = None,
    categoria_id: int | None = None,
    activo: bool | None = None,
) -> tuple[ReglaMotivo, ReglaMotivo]:
    """
    Actualiza nombre, categoría y/o estado activo de un motivo de movimiento.
    Valida motivos reservados, unicidad y no dejar vacías categorías del sistema.
    """
    motivo_actual = repo.obtener_motivo(motivo_id)
    nueva_categoria = repo.obtener_categoria_motivo(categoria_id) if categoria_id is not None else None
    conteo_activos = repo.contar_motivos_activos_en_categoria(motivo_actual.categoria_id)

    validar_edicion_motivo(motivo_actual, movimiento, nueva_categoria, activo, conteo_activos)

    actualizado = repo.actualizar_motivo(
        motivo_id,
        movimiento=movimiento,
        categoria_id=categoria_id,
        activo=activo,
    )
    return motivo_actual, actualizado


def eliminar_motivo(
    repo: RepoReglasCatalogos,
    motivo_id: int,
) -> ReglaMotivo:
    """
    Elimina físicamente un motivo si no es reservado y no tiene movimientos asociados.
    Si tiene movimientos, se rechaza y se instruye desactivarlo.
    """
    motivo_actual = repo.obtener_motivo(motivo_id)
    tiene_referencias = repo.motivo_tiene_referencias(motivo_id)
    validar_eliminacion_motivo(motivo_actual, tiene_referencias)
    return repo.eliminar_motivo(motivo_id)


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


def crear_parentesco(
    repo: RepoReglasCatalogos,
    descripcion: str,
    aplica_familiar: bool = True,
) -> ReglaParentesco:
    """Alta de parentesco (O36): nombre único sin distinguir mayúsculas."""
    nombre, aplica = preparar_nuevo_parentesco(descripcion, aplica_familiar)
    return repo.crear_parentesco(nombre, aplica)


def editar_parentesco(
    repo: RepoReglasCatalogos,
    parentesco_id: int,
    descripcion: str | None,
    aplica_familiar: bool | None,
) -> tuple[ReglaParentesco, ReglaParentesco]:
    """Edición de nombre/marca del parentesco, protegiendo el reservado."""
    anterior = repo.obtener_parentesco(parentesco_id)
    nombre = None
    if descripcion is not None:
        nombre = normalizar_nombre_catalogo(
            descripcion, campo='descripcion', maximo=LARGO_MAXIMO_PARENTESCO,
        )
        validar_edicion_parentesco(anterior, nombre)
    actualizado = repo.actualizar_parentesco(
        parentesco_id,
        anterior.aplica_familiar if aplica_familiar is None else aplica_familiar,
        descripcion=nombre,
    )
    return anterior, actualizado


def eliminar_parentesco(
    repo: RepoReglasCatalogos,
    parentesco_id: int,
) -> ReglaParentesco:
    """Baja física solo si no tiene referencias y no es reservado."""
    actual = repo.obtener_parentesco(parentesco_id)
    tiene_referencias = repo.parentesco_tiene_referencias(parentesco_id)
    validar_eliminacion_parentesco(actual, tiene_referencias)
    return repo.eliminar_parentesco(parentesco_id)


def crear_nomina(
    repo: RepoReglasCatalogos,
    nomina: str,
    es_activo: bool,
    requiere_codig: bool,
) -> ReglaNomina:
    """Alta de tipo de nómina (O36) con su clasificación y requiere_codig."""
    nombre, activo, codig = preparar_nueva_nomina(nomina, es_activo, requiere_codig)
    return repo.crear_nomina(nombre, activo, codig)


def editar_nomina(
    repo: RepoReglasCatalogos,
    nomina_id: int,
    nomina: str | None,
    es_activo: bool | None,
    requiere_codig: bool | None,
) -> tuple[ReglaNomina, ReglaNomina]:
    """Edición de nómina, protegiendo las nóminas reservadas del sistema."""
    anterior = repo.obtener_nomina(nomina_id)
    validar_activacion_nomina(anterior, es_activo)
    nombre = None
    if nomina is not None:
        nombre = normalizar_nombre_catalogo(nomina, campo='nomina', maximo=LARGO_MAXIMO_NOMINA)
        validar_edicion_nomina(anterior, nombre)
    actualizado = repo.actualizar_nomina(
        nomina_id, es_activo, requiere_codig, nomina=nombre,
    )
    return anterior, actualizado


def eliminar_nomina(
    repo: RepoReglasCatalogos,
    nomina_id: int,
) -> ReglaNomina:
    """Baja física solo si no tiene referencias y no es reservada."""
    actual = repo.obtener_nomina(nomina_id)
    tiene_referencias = repo.nomina_tiene_referencias(nomina_id)
    validar_eliminacion_nomina(actual, tiene_referencias)
    return repo.eliminar_nomina(nomina_id)


def actualizar_nomina(
    repo: RepoReglasCatalogos,
    nomina_id: int,
    es_activo: bool | None,
    requiere_codig: bool | None,
) -> tuple[ReglaNomina, ReglaNomina]:
    """Actualiza marcas es_activo y/o requiere_codig de un tipo de nómina. Devuelve (anterior, actualizado)."""
    anterior = repo.obtener_nomina(nomina_id)
    validar_activacion_nomina(anterior, es_activo)
    actualizado = repo.actualizar_nomina(nomina_id, es_activo, requiere_codig)
    return anterior, actualizado
