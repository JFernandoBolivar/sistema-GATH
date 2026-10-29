"""
Entidades de la solicitud de actualización de datos (PLAN_PRIORIDAD §2.1 y §2.3).

Inmutables; cada transición devuelve una copia nueva y valida la máquina de estados.
Sin Django (regla B1). Los actores se registran por cédula.
"""
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from apps.autogestion.domain.value_objects.estado_solicitud import (
    ESTADOS_ABIERTOS,
    EstadoSolicitud,
    validar_transicion,
)
from apps.autogestion.domain.value_objects.secciones import DecisionCambio
from core.domain.exceptions import ConflictError, ValidationError

PLAZO_DIAS_MIN = 1
PLAZO_DIAS_MAX = 90


@dataclass(frozen=True)
class SolicitudActualizacion:
    id: str
    cedula: str
    estado: EstadoSolicitud
    secciones_solicitadas: tuple[str, ...]
    motivo: str
    secciones_habilitadas: tuple[str, ...] = ()
    ventana_inicio: datetime | None = None
    ventana_fin: datetime | None = None
    plazo_dias: int | None = None
    habilitada_por: str = ''
    decidida_por: str = ''
    motivo_decision: str = ''
    version: int = 1
    fecha_solicitud: datetime | None = None
    fecha_envio: datetime | None = None
    fecha_decision: datetime | None = None

    @property
    def abierta(self) -> bool:
        return self.estado in ESTADOS_ABIERTOS

    def ventana_vigente(self, ahora: datetime) -> bool:
        return (
            self.estado is EstadoSolicitud.HABILITADA
            and self.ventana_fin is not None
            and ahora <= self.ventana_fin
        )

    def exigir_ventana_vigente(self, ahora: datetime) -> None:
        if self.estado is not EstadoSolicitud.HABILITADA:
            raise ConflictError(f"La solicitud está {self.estado.value}: no admite cambios del trabajador.")
        if not self.ventana_vigente(ahora):
            raise ConflictError("La ventana de actualización venció. Solicite una nueva actualización.")

    # ── Transiciones ──
    def habilitar(self, secciones: tuple[str, ...], plazo_dias: int, actor: str, ahora: datetime) -> 'SolicitudActualizacion':
        if self.estado is not EstadoSolicitud.SOLICITADA:
            raise ConflictError("Solo se habilita la ventana de una solicitud en estado SOLICITADA.")
        validar_transicion(self.estado, EstadoSolicitud.HABILITADA)
        if not PLAZO_DIAS_MIN <= plazo_dias <= PLAZO_DIAS_MAX:
            raise ValidationError(f"El plazo debe estar entre {PLAZO_DIAS_MIN} y {PLAZO_DIAS_MAX} días.")
        if not secciones or not set(secciones) <= set(self.secciones_solicitadas):
            raise ValidationError("Las secciones a habilitar deben ser un subconjunto no vacío de las solicitadas.")
        return replace(
            self, estado=EstadoSolicitud.HABILITADA, secciones_habilitadas=tuple(secciones),
            ventana_inicio=ahora, ventana_fin=ahora + timedelta(days=plazo_dias), plazo_dias=plazo_dias,
            habilitada_por=actor,
        )

    def prorrogar(self, nueva_fin: datetime, ahora: datetime) -> 'SolicitudActualizacion':
        validar_transicion(self.estado, EstadoSolicitud.HABILITADA)
        if self.estado is not EstadoSolicitud.HABILITADA:
            raise ConflictError("Solo se prorroga una ventana habilitada.")
        if nueva_fin <= ahora or (self.ventana_fin and nueva_fin <= self.ventana_fin):
            raise ValidationError("La nueva fecha límite debe ser posterior a la vigente y a la fecha actual.")
        if nueva_fin > ahora + timedelta(days=PLAZO_DIAS_MAX):
            raise ValidationError(f"La prórroga no puede exceder {PLAZO_DIAS_MAX} días desde hoy.")
        return replace(self, ventana_fin=nueva_fin)

    def enviar(self, ahora: datetime) -> 'SolicitudActualizacion':
        self.exigir_ventana_vigente(ahora)
        validar_transicion(self.estado, EstadoSolicitud.ENVIADA)
        return replace(self, estado=EstadoSolicitud.ENVIADA, fecha_envio=ahora)

    def expirar(self) -> 'SolicitudActualizacion':
        validar_transicion(self.estado, EstadoSolicitud.EXPIRADA)
        return replace(self, estado=EstadoSolicitud.EXPIRADA)

    def decidir(self, destino: EstadoSolicitud, actor: str, motivo: str, ahora: datetime) -> 'SolicitudActualizacion':
        validar_transicion(self.estado, destino)
        if destino is EstadoSolicitud.HABILITADA or destino is EstadoSolicitud.EXPIRADA:
            raise ConflictError("Destino inválido para una decisión.")
        if actor == self.cedula:
            raise ConflictError("Nadie puede decidir su propia solicitud de actualización.")
        return replace(self, estado=destino, decidida_por=actor, motivo_decision=motivo, fecha_decision=ahora)


@dataclass(frozen=True)
class ProrrogaVentana:
    id: str
    solicitud_id: str
    fecha_fin_anterior: datetime
    fecha_fin_nueva: datetime
    motivo: str
    prorrogada_por: str
    fecha: datetime | None = None


@dataclass(frozen=True)
class CambioPropuesto:
    """Compartido con la fe de vida (`origen_tipo`). Un MODIFICAR es un campo; un CREAR, un registro."""

    id: str
    origen_tipo: str
    origen_id: str
    seccion: str
    accion: str
    entidad_destino: str
    campo: str
    valor_propuesto: object
    entidad_id: str | None = None
    valor_anterior: object = None
    decision: DecisionCambio = DecisionCambio.PENDIENTE
    motivo_decision: str = ''
    decidido_por: str = ''
    fecha_decision: datetime | None = None

    def con_decision(self, decision: DecisionCambio, motivo: str, actor: str, ahora: datetime) -> 'CambioPropuesto':
        if self.decision is not DecisionCambio.PENDIENTE:
            raise ConflictError("El cambio ya fue decidido.")
        if decision is DecisionCambio.RECHAZADO and not motivo.strip():
            raise ValidationError("El rechazo de un campo exige un motivo.")
        return replace(self, decision=decision, motivo_decision=motivo.strip(), decidido_por=actor, fecha_decision=ahora)


@dataclass(frozen=True)
class SoporteDocumental:
    id: str
    origen_tipo: str
    origen_id: str
    seccion: str
    tipo: str
    clave_s3: str
    mime_real: str
    tamano_bytes: int
    sha256: str
    nombre_original: str
    subido_por: str
    fecha: datetime | None = None


@dataclass(frozen=True)
class SeccionAutogestionable:
    codigo: str
    nombre: str
    requiere_soporte: bool
    activa: bool = True


@dataclass(frozen=True)
class DatosComplementarios:
    cedula: str
    correo_alternativo: str | None = None
    tiene_hijos: bool | None = None
    actualizado_en: datetime | None = None
    actualizado_por: str = ''
