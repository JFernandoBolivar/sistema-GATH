"""
DTOs de Carnetización (Regla B5, O44 - E3).
"""
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CarnetDTO:
    id: int
    empleado_cedula: str
    empleado_nombres: str
    empleado_apellidos: str
    security_hash: str
    fecha_emision: str
    motivo_id: int
    motivo_nombre: str
    activo: bool
    observaciones: str | None = None
    plantilla_id: str | int | None = None
    plantilla_version: int | None = None
    plantilla_snapshot: dict[str, Any] | None = None


@dataclass(frozen=True)
class PlantillaCarnetDTO:
    id: int | str
    nombre: str
    imagen_url: str
    activo: bool
    creado: str


@dataclass(frozen=True)
class TipoCredencialDTO:
    codigo: str
    nombre: str
    descripcion: str
    ancho_mm: float
    alto_mm: float
    orientacion: str
    activo: bool
    orden: int


@dataclass(frozen=True)
class PlantillaDetalleDTO:
    id: str | int
    nombre: str
    codigo_tipo: str
    ancho_mm: float
    alto_mm: float
    orientacion: str
    regla_criterio: str
    regla_valor: str
    estado: str
    activa: bool
    version: int
    definicion: dict[str, Any]
    creado: str
    actualizado: str
    plantilla_raiz_id: str | int | None = None
    creado_por: str | None = None
    descripcion: str = ""
    imagen_url: str = ""


@dataclass(frozen=True)
class ValidacionCarnetDTO:
    es_valido: bool
    carnet: CarnetDTO | None = None
    mensaje: str = ""


@dataclass(frozen=True)
class ElementoBibliotecaDTO:
    id: str
    nombre: str
    categoria: str
    archivo_url: str
    tamano_bytes: int
    mime_type: str
    ancho_px: int | None
    alto_px: int | None
    creado: str
    creado_por: str | None = None
    descripcion: str = ""


@dataclass(frozen=True)
class CampoCredencialDTO:
    codigo: str
    etiqueta: str
    grupo: str
    tipo_credencial: str
    sensible: bool
    es_personalizado: bool
    descripcion: str = ""
    valor_ejemplo: str = ""


from apps.carnetizacion.domain.entities.privacidad import FichaQr

FichaQrDTO = FichaQr
