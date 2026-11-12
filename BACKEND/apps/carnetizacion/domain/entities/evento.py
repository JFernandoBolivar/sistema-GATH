"""
Entidades de dominio para Eventos, Invitados y Control de Entrada (Regla B1, O45-B).
"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class EstadoEvento(str, Enum):
    BORRADOR = "borrador"
    ACTIVO = "activo"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"


class EstadoInvitado(str, Enum):
    REGISTRADO = "registrado"
    EMITIDO = "emitido"
    INGRESO = "ingreso"
    ANULADO = "anulado"


class ResolucionCarnetInstitucional(str, Enum):
    """Qué es un código escaneado que no pertenece a ningún gafete de evento."""
    NO_ES_CARNET = "NO_ES_CARNET"
    ANULADO = "ANULADO"
    VENCIDO = "VENCIDO"
    NO_INVITADO = "NO_INVITADO"
    INVITADO = "INVITADO"


class ResultadoControlEntrada(str, Enum):
    ACCESO_PERMITIDO = "ACCESO_PERMITIDO"
    YA_INGRESO = "YA_INGRESO"
    NO_VALIDA = "NO_VALIDA"


@dataclass
class Evento:
    id: str
    nombre: str
    lugar: str
    fecha_inicio: datetime
    fecha_fin: datetime
    descripcion: str = ""
    estado: EstadoEvento = EstadoEvento.ACTIVO
    plantilla_id: str | None = None
    creado_por_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def esta_vigente(self, ahora: datetime | None = None) -> bool:
        if self.estado in (EstadoEvento.CANCELADO, EstadoEvento.FINALIZADO):
            return False
        if not self.fecha_fin:
            return True
        tz = self.fecha_fin.tzinfo
        if ahora is None:
            momento = datetime.now(tz) if tz else datetime.now()
        else:
            momento = ahora
            if tz and momento.tzinfo is None:
                momento = momento.replace(tzinfo=tz)
            elif tz is None and momento.tzinfo is not None:
                momento = momento.replace(tzinfo=None)
        return momento <= self.fecha_fin


@dataclass
class EventoCategoria:
    id: str
    evento_id: str
    nombre: str
    color_primario: str = "#0B4A9E"
    color_acento: str = "#F59E0B"
    orden: int = 1
    plantilla_id: str | None = None


@dataclass
class EventoZona:
    id: str
    evento_id: str
    nombre: str
    codigo: str = ""
    orden: int = 1


@dataclass
class EventoInvitado:
    id: str
    evento_id: str
    nombre_completo: str
    categoria_id: str
    zona_id: str
    documento_identidad: str = ""
    organizacion: str = ""
    correo: str = ""
    telefono: str = ""
    mesa: str = ""
    codigo_credencial: str = ""
    security_hash: str = ""
    es_acompanante: bool = False
    trabajador_titular_id: int | None = None
    estado: EstadoInvitado = EstadoInvitado.REGISTRADO
    fecha_emision: datetime | None = None
    fecha_ingreso: datetime | None = None
    ingreso_registrado_por_id: int | None = None
    observaciones: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def ya_ingreso(self) -> bool:
        return self.estado == EstadoInvitado.INGRESO or self.fecha_ingreso is not None


@dataclass
class RegistroAccesoEvento:
    id: str
    evento_id: str
    resultado: ResultadoControlEntrada
    invitado_id: str | None = None
    zona_id: str | None = None
    registrado_por_id: int | None = None
    fecha_ingreso: datetime | None = None
    observaciones: str = ""


@dataclass
class ResumenPanelEvento:
    evento_id: str
    nombre_evento: str
    total_invitados: int
    credenciales_emitidas: int
    entraron: int
    faltan: int
    por_categoria: dict[str, int] = field(default_factory=dict)
    por_zona: dict[str, int] = field(default_factory=dict)


@dataclass
class ResultadoCheckIn:
    resultado: ResultadoControlEntrada
    mensaje: str
    invitado_id: str | None = None
    nombre_completo: str | None = None
    documento_identidad: str | None = None
    organizacion: str | None = None
    categoria_nombre: str | None = None
    zona_nombre: str | None = None
    mesa: str | None = None
    codigo_credencial: str | None = None
    fecha_ingreso: datetime | None = None
    hora_ingreso_formateada: str | None = None
