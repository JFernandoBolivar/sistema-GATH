"""Entidades de dominio de los documentos digitales (F-1)."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class VersionPlantilla:
    id: str
    plantilla_id: str
    numero: int
    modo: str
    definicion: dict
    campos_propios: list
    fondo_clave: str
    fondo_sha256: str
    fondo_paginas: list
    metadatos: dict
    definicion_sha256: str
    publicada_por_id: int | None = None
    publicada_en: datetime | None = None


@dataclass
class Plantilla:
    id: str
    codigo: str
    nombre: str
    descripcion: str
    modo: str
    momento: str
    firmante: str
    requiere_firma_clic: bool
    activa: bool
    estado: str  # 'borrador' (nunca publicada) | 'publicada'
    ultima_version: int
    definicion: dict
    campos_propios: list
    fondo_clave: str = ''
    fondo_sha256: str = ''
    fondo_nombre: str = ''
    fondo_paginas: list = field(default_factory=list)
    cambios_sin_publicar: bool = False
    actualizada_en: datetime | None = None


@dataclass
class DocumentoGenerado:
    id: str
    plantilla_id: str
    version_id: str
    version_numero: int
    sujeto_tipo: str
    sujeto_id: str
    datos_snapshot: dict
    pdf_clave: str
    pdf_sha256: str
    generado_por_id: int | None
    generado_en: datetime | None = None
    huella_datos: str = ''          # huella de los datos usados (sin las fechas del día): detecta que cambiaron tras firmar
    trabajador_cedula: str = ''     # al contratar: cédula del trabajador (id opaco, sin FK a personal)


@dataclass
class FirmaDocumento:
    id: str
    documento_id: str
    firmante_tipo: str
    firmante_id: str
    firmado_en: datetime
    ip: str
    user_agent: str
    sha256_firmado: str
    texto_conformidad: str


@dataclass
class ValoresDocumento:
    """Valores de los campos propios que el sujeto dio a un documento: `{clave: valor}` (sin el prefijo `propio.`)."""

    sujeto_tipo: str
    sujeto_id: str
    plantilla_id: str
    valores: dict
