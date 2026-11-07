"""
Catálogo configurable de tipos de soporte documental (O41).

Conceptos compartidos por Autogestión y Configuración: los tipos de documento
que el sistema conoce, la marca de reservado/protegido y el checklist que dice
qué tipos admite (y cuáles exige) cada sección de la solicitud.

Puro: sin Django ni DRF (regla B1).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TipoSoporteConfigurado:
    """Tipo de documento del catálogo (código estable + nombre visible)."""

    id: int
    codigo: str
    nombre: str
    es_reservado: bool
    es_protegido: bool
    orden: int


@dataclass(frozen=True)
class ChecklistSoporteConfigurado:
    """Un tipo dentro del checklist de una sección.

    `permitido` = el trabajador puede subir ese tipo en la sección.
    `requerido` = una regla del sistema exige ese tipo en la sección; no puede
    quitarse del checklist.
    """

    id: int
    seccion: str
    tipo_soporte_id: int
    codigo: str
    nombre: str
    etiqueta: str
    permitido: bool
    requerido: bool
    orden: int


@dataclass(frozen=True)
class ItemChecklistSoporte:
    """Propuesta de una fila del checklist para guardarlo."""

    tipo_soporte_id: int
    permitido: bool
    requerido: bool


@dataclass(frozen=True)
class SeccionSoporte:
    """Sección autogestionable que admite un checklist de documentos."""

    codigo: str
    nombre: str
