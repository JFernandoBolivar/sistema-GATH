"""
Solicitud de fe de vida: una por pasivo y proceso (PLAN_PRIORIDAD §2.2). Inmutable; cada transición
devuelve una copia y valida la máquina de estados y la regla de doble check. Sin Django.
"""
from dataclasses import dataclass, field, replace
from datetime import datetime

from apps.fe_de_vida.domain.value_objects.estados import (
    ESTADOS_EDITABLES,
    ESTADOS_REVISABLES,
    EstadoSolicitud,
    OrigenEvidencia,
    RolRevision,
    TipoDecision,
    ViaAprobacion,
    validar_transicion_solicitud,
)
from apps.fe_de_vida.domain.services.validacion_motivo import validar_motivo
from core.domain.exceptions import ConflictError, ValidationError

MENSAJE_YA_DIO_CHECK = "Usted ya aprobó esta fe de vida; la siguiente revisión corresponde a otra persona."

ACCION_CHECK = 'dar_check'
ACCION_APROBAR_DIRECTO = 'aprobar_directo'
ACCION_DEVOLVER = 'devolver'
ACCION_RECHAZAR = 'rechazar'
ACCION_RETIRAR_CHECK = 'retirar_check'


@dataclass(frozen=True)
class ActorRevision:
    """Quien revisa: su cédula y el rol con el que actúa (derivado de su permiso, no de un nombre de rol)."""

    cedula: str
    rol: RolRevision

    def __post_init__(self):
        if not self.cedula:
            raise ValidationError("El revisor debe identificarse.")


@dataclass(frozen=True)
class PermisosRevision:
    """Qué puede hacer el revisor por sus permisos (la capa de presentación los traduce de los códigos)."""

    revisar: bool = False
    check: bool = False
    aprobar_directo: bool = False


@dataclass(frozen=True)
class DecisionFeDeVida:
    tipo: TipoDecision
    rol: RolRevision
    actor_cedula: str
    envio: int
    fecha: datetime
    motivo: str = ''


@dataclass(frozen=True)
class SolicitudFeDeVida:
    id: str
    proceso_id: str
    cedula: str
    estado: EstadoSolicitud = EstadoSolicitud.BORRADOR
    version: int = 1
    envios: int = 0
    origen_evidencia: OrigenEvidencia | None = None
    evidencia_clave: str = ''
    evidencia_sha256: str = ''
    evidencia_mime: str = ''
    evidencia_tamano: int = 0
    metadatos_captura: dict = field(default_factory=dict)
    evidencias_previas: tuple[str, ...] = ()
    via_aprobacion: ViaAprobacion | None = None
    decisiones: tuple[DecisionFeDeVida, ...] = ()
    fecha_envio: datetime | None = None
    fecha_validacion: datetime | None = None
    requiere_nueva_foto: bool = False  # la devolución exige una foto nueva (la vigente pasó al historial)

    # ── Consultas ──
    @property
    def editable(self) -> bool:
        return self.estado in ESTADOS_EDITABLES

    @property
    def revisable(self) -> bool:
        return self.estado in ESTADOS_REVISABLES

    def checks_vigentes(self) -> tuple[DecisionFeDeVida, ...]:
        """Checks del envío en curso que no fueron retirados (un retiro anula el check previo de esa persona)."""
        vigentes: list[DecisionFeDeVida] = []
        for d in self.decisiones:
            if d.envio != self.envios:
                continue
            if d.tipo is TipoDecision.CHECK:
                vigentes.append(d)
            elif d.tipo is TipoDecision.CHECK_RETIRADO:
                vigentes = [c for c in vigentes if c.actor_cedula != d.actor_cedula]
        return tuple(vigentes)

    def dio_check(self, cedula: str) -> bool:
        return any(d.actor_cedula == cedula for d in self.checks_vigentes())

    def acciones_disponibles(self, actor: ActorRevision, permisos: PermisosRevision) -> tuple[str, ...]:
        """
        Acciones que `actor` puede ejecutar hoy sobre la solicitud (la regla vive aquí; la interfaz solo las pinta).
        Quien ya dio su check no puede dar otro, devolver ni rechazar: solo retirarlo o, si es la Administradora,
        aprobar de forma directa. Nadie revisa su propia fe de vida.
        """
        if not self.revisable or actor.cedula == self.cedula:
            return ()
        if self.dio_check(actor.cedula):
            acciones = [ACCION_RETIRAR_CHECK]
            if permisos.aprobar_directo and actor.rol is RolRevision.ADMINISTRADORA:
                acciones.insert(0, ACCION_APROBAR_DIRECTO)
            return tuple(acciones)
        acciones = []
        if permisos.check and not any(d.rol is actor.rol for d in self.checks_vigentes()):
            acciones.append(ACCION_CHECK)
        if permisos.aprobar_directo and actor.rol is RolRevision.ADMINISTRADORA:
            acciones.append(ACCION_APROBAR_DIRECTO)
        if permisos.revisar:
            acciones += [ACCION_DEVOLVER, ACCION_RECHAZAR]
        return tuple(acciones)

    # ── Trámite del pasivo ──
    def con_evidencia(
        self, origen: OrigenEvidencia, clave: str, sha256: str, mime: str, tamano: int, metadatos: dict | None = None,
    ) -> 'SolicitudFeDeVida':
        if not self.editable:
            raise ConflictError(f"La solicitud está {self.estado.value}: no admite una nueva foto.")
        previas = self.evidencias_previas + ((self.evidencia_clave,) if self.evidencia_clave else ())
        return replace(
            self, origen_evidencia=origen, evidencia_clave=clave, evidencia_sha256=sha256, evidencia_mime=mime,
            evidencia_tamano=tamano, metadatos_captura=dict(metadatos or {}), evidencias_previas=previas,
        )

    def enviar(self, ahora: datetime) -> 'SolicitudFeDeVida':
        if not self.editable:
            raise ConflictError(f"La solicitud está {self.estado.value}: no puede enviarse.")
        if not self.evidencia_clave:
            raise ValidationError("Debe tomar o subir la foto con su cédula antes de enviar.")
        validar_transicion_solicitud(self.estado, EstadoSolicitud.PENDIENTE_REVISION)
        return replace(
            self, estado=EstadoSolicitud.PENDIENTE_REVISION, envios=self.envios + 1, fecha_envio=ahora,
            requiere_nueva_foto=False,
        )

    # ── Revisión de Bienestar ──
    def _exigir_revisable(self, actor: ActorRevision) -> None:
        if not self.revisable:
            raise ConflictError(f"La solicitud está {self.estado.value}: no admite revisión.")
        if actor.cedula == self.cedula:
            raise ConflictError("No puede revisar su propia fe de vida.")

    def dar_check(self, actor: ActorRevision, ahora: datetime) -> 'SolicitudFeDeVida':
        """
        Doble check, orden indistinto. El primero deja la solicitud en PENDIENTE_SEGUNDO_CHECK; el segundo,
        de la OTRA persona y del OTRO rol, la valida. Un check solo nunca valida (la Analista no valida sola).
        """
        self._exigir_revisable(actor)
        previos = self.checks_vigentes()
        if any(d.actor_cedula == actor.cedula for d in previos):
            raise ConflictError(MENSAJE_YA_DIO_CHECK)
        if any(d.rol is actor.rol for d in previos):
            raise ConflictError(f"El check de {actor.rol.value} ya fue dado: falta el del otro rol.")
        decision = DecisionFeDeVida(TipoDecision.CHECK, actor.rol, actor.cedula, self.envios, ahora)
        if not previos:
            validar_transicion_solicitud(self.estado, EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK)
            return replace(self, estado=EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK, decisiones=self.decisiones + (decision,))
        validar_transicion_solicitud(self.estado, EstadoSolicitud.VALIDADA)
        return replace(
            self, estado=EstadoSolicitud.VALIDADA, via_aprobacion=ViaAprobacion.DOBLE_CHECK,
            decisiones=self.decisiones + (decision,), fecha_validacion=ahora,
        )

    def aprobar_directo(self, actor: ActorRevision, justificacion: str, ahora: datetime) -> 'SolicitudFeDeVida':
        """Excepción: solo la Administradora, con justificación obligatoria (auditada)."""
        self._exigir_revisable(actor)
        if actor.rol is not RolRevision.ADMINISTRADORA:
            raise ConflictError("Solo la Administradora de Bienestar puede aprobar de forma directa.")
        if not justificacion or not justificacion.strip():
            raise ValidationError("La aprobación directa exige una justificación.")
        validar_transicion_solicitud(self.estado, EstadoSolicitud.VALIDADA)
        decision = DecisionFeDeVida(
            TipoDecision.APROBACION_DIRECTA, actor.rol, actor.cedula, self.envios, ahora, justificacion.strip(),
        )
        return replace(
            self, estado=EstadoSolicitud.VALIDADA, via_aprobacion=ViaAprobacion.DIRECTA_ADMINISTRADORA,
            decisiones=self.decisiones + (decision,), fecha_validacion=ahora,
        )

    def retirar_check(self, actor: ActorRevision, motivo: str, ahora: datetime) -> 'SolicitudFeDeVida':
        """
        Quien dio un check que aún no completó la validación puede retirarlo (justificación obligatoria). Si no
        queda ningún check vigente, la solicitud vuelve a PENDIENTE_REVISION. El retiro queda en el historial.
        """
        self._exigir_revisable(actor)
        if not self.dio_check(actor.cedula):
            raise ConflictError("Usted no tiene un check vigente en esta fe de vida para retirar.")
        motivo = validar_motivo(motivo)
        restantes = [d for d in self.checks_vigentes() if d.actor_cedula != actor.cedula]
        nuevo = EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK if restantes else EstadoSolicitud.PENDIENTE_REVISION
        if nuevo is not self.estado:
            validar_transicion_solicitud(self.estado, nuevo)
        decision = DecisionFeDeVida(TipoDecision.CHECK_RETIRADO, actor.rol, actor.cedula, self.envios, ahora, motivo)
        return replace(self, estado=nuevo, decisiones=self.decisiones + (decision,))

    def _cerrar_con_motivo(
        self, actor: ActorRevision, motivo: str, ahora: datetime, tipo: TipoDecision, nuevo: EstadoSolicitud,
    ) -> 'SolicitudFeDeVida':
        self._exigir_revisable(actor)
        if self.dio_check(actor.cedula):
            raise ConflictError(MENSAJE_YA_DIO_CHECK)
        if not motivo or not motivo.strip():
            raise ValidationError("Debe indicar el motivo.")
        validar_transicion_solicitud(self.estado, nuevo)
        decision = DecisionFeDeVida(tipo, actor.rol, actor.cedula, self.envios, ahora, motivo.strip())
        return replace(self, estado=nuevo, decisiones=self.decisiones + (decision,))

    def rechazar(self, actor: ActorRevision, motivo: str, ahora: datetime) -> 'SolicitudFeDeVida':
        return self._cerrar_con_motivo(actor, motivo, ahora, TipoDecision.RECHAZO, EstadoSolicitud.RECHAZADA)

    def devolver(
        self, actor: ActorRevision, motivo: str, ahora: datetime, requiere_nueva_foto: bool = False,
    ) -> 'SolicitudFeDeVida':
        """
        Devuelta para corrección (motivo obligatorio): el pasivo corrige los datos del acta y, si el revisor lo
        pide, la foto (entonces la vigente pasa al historial). Los checks no se reutilizan al reenviar.
        """
        nueva = self._cerrar_con_motivo(actor, motivo, ahora, TipoDecision.DEVOLUCION, EstadoSolicitud.DEVUELTA)
        nueva = replace(nueva, requiere_nueva_foto=requiere_nueva_foto)
        if not requiere_nueva_foto:
            return nueva
        return replace(
            nueva, evidencia_clave='', evidencia_sha256='', evidencia_mime='', evidencia_tamano=0,
            origen_evidencia=None, metadatos_captura={},
            evidencias_previas=self.evidencias_previas + ((self.evidencia_clave,) if self.evidencia_clave else ()),
        )

    # ── Sistema ──
    def expirar(self) -> 'SolicitudFeDeVida':
        validar_transicion_solicitud(self.estado, EstadoSolicitud.EXPIRADA)
        return replace(self, estado=EstadoSolicitud.EXPIRADA)

    def rehabilitar(self) -> 'SolicitudFeDeVida':
        """Una prórroga posterior al cierre devuelve la solicitud expirada a BORRADOR."""
        validar_transicion_solicitud(self.estado, EstadoSolicitud.BORRADOR)
        return replace(self, estado=EstadoSolicitud.BORRADOR)

    def archivar(self) -> 'SolicitudFeDeVida':
        validar_transicion_solicitud(self.estado, EstadoSolicitud.ARCHIVADA)
        return replace(self, estado=EstadoSolicitud.ARCHIVADA)
