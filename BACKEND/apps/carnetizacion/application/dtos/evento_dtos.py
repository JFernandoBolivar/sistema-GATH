"""
DTOs para Eventos, Invitados, Check-in y Panel (Regla B4, O45-B).
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class EventoCategoriaDTO:
    id: str
    evento_id: str
    nombre: str
    color_primario: str = "#0B4A9E"
    color_acento: str = "#F59E0B"
    orden: int = 1
    plantilla_id: str | None = None


@dataclass
class EventoZonaDTO:
    id: str
    evento_id: str
    nombre: str
    codigo: str = ""
    orden: int = 1


@dataclass
class EventoDTO:
    id: str
    nombre: str
    lugar: str
    fecha_inicio: str
    fecha_fin: str
    descripcion: str = ""
    estado: str = "activo"
    plantilla_id: str | None = None
    creado_por_id: int | None = None
    created_at: str | None = None
    updated_at: str | None = None
    categorias: list[EventoCategoriaDTO] = field(default_factory=list)
    zonas: list[EventoZonaDTO] = field(default_factory=list)
    total_invitados: int = 0
    total_entraron: int = 0


@dataclass
class EventoCrearDTO:
    nombre: str
    lugar: str
    fecha_inicio: datetime
    fecha_fin: datetime
    descripcion: str = ""
    plantilla_id: str | None = None
    categorias: list[dict[str, Any]] = field(default_factory=list)
    zonas: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class EventoInvitadoDTO:
    id: str
    evento_id: str
    nombre_completo: str
    categoria_id: str
    zona_id: str
    categoria_nombre: str = ""
    zona_nombre: str = ""
    documento_identidad: str = ""
    organizacion: str = ""
    correo: str = ""
    telefono: str = ""
    mesa: str = ""
    codigo_credencial: str = ""
    security_hash: str = ""
    es_acompanante: bool = False
    trabajador_titular_id: int | None = None
    trabajador_titular_nombre: str | None = None
    estado: str = "registrado"
    fecha_emision: str | None = None
    fecha_ingreso: str | None = None
    hora_ingreso_formateada: str | None = None
    observaciones: str = ""
    created_at: str | None = None


@dataclass
class InvitadoCrearDTO:
    evento_id: str
    nombre_completo: str
    categoria_id: str
    zona_id: str
    documento_identidad: str = ""
    organizacion: str = ""
    correo: str = ""
    telefono: str = ""
    mesa: str = ""
    es_acompanante: bool = False
    trabajador_titular_id: int | None = None
    observaciones: str = ""


@dataclass
class InvitadoImportarFilaDTO:
    fila: int
    nombre_completo: str
    categoria_nombre: str
    zona_nombre: str
    documento_identidad: str = ""
    organizacion: str = ""
    correo: str = ""
    telefono: str = ""
    mesa: str = ""
    valida: bool = True
    error: str = ""


@dataclass
class ResumenImportacionDTO:
    total_filas: int
    filas_validas: int
    filas_invalidas: int
    filas: list[InvitadoImportarFilaDTO] = field(default_factory=list)


@dataclass
class CheckInRequestDTO:
    codigo_o_hash: str
    evento_id: str | None = None
    zona_id: str | None = None


@dataclass
class CheckInResponseDTO:
    resultado: str  # 'ACCESO_PERMITIDO', 'YA_INGRESO', 'NO_VALIDA'
    mensaje: str
    invitado_id: str | None = None
    nombre_completo: str | None = None
    documento_identidad: str | None = None
    organizacion: str | None = None
    categoria_nombre: str | None = None
    zona_nombre: str | None = None
    mesa: str | None = None
    codigo_credencial: str | None = None
    hora_ingreso_formateada: str | None = None


@dataclass
class PanelEventoDTO:
    evento_id: str
    nombre_evento: str
    lugar: str
    fecha_inicio: str
    fecha_fin: str
    estado: str
    total_invitados: int
    credenciales_emitidas: int
    entraron: int
    faltan: int
    porcentaje_asistencia: float
    por_categoria: dict[str, int] = field(default_factory=dict)
    por_zona: dict[str, int] = field(default_factory=dict)
