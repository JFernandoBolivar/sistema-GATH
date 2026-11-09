"""
Solicitud de fe de vida: una por pasivo y proceso (PLAN_PRIORIDAD §2.2). Inmutable; cada transición
devuelve una copia y valida la máquina de estados y la regla de doble check. Sin Django.
"""
from dataclasses import dataclass, field, replace
from datetime import datetime
from enum import Enum

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

class Canal(str, Enum):
    EN_LINEA = 'EN_LINEA'
    PRESENCIAL = 'PRESENCIAL'


MENSAJE_YA_DIO_CHECK = "Usted ya aprobó esta fe de vida; la siguiente revisión corresponde a otra persona."
MENSAJE_REGISTRADOR_NO_DECIDE = (
    "Usted registró esta fe de vida de forma presencial: la revisión debe hacerla otra persona de Bienestar Social."
)

MENSAJE_ADMIN_REGISTRADORA_SOLO_APROBACION = (
    "Usted registró esta fe de vida de forma presencial: el parámetro del sistema no le permite revisarla. "
    "La revisión debe hacerla otra persona de Bienestar Social."
)
MENSAJE_REGISTRADOR_APROBACION_DESHABILITADA = (
    "Usted registró esta fe de vida de forma presencial: el parámetro del sistema no le permite aprobarla "
    "de forma directa; la revisión debe hacerla otra persona de Bienestar Social."
)

ACCION_CHECK = 'dar_check'
ACCION_APROBAR_DIRECTO = 'aprobar_directo'
ACCION_DEVOLVER = 'devolver'
ACCION_RECHAZAR = 'rechazar'
ACCION_RETIRAR_CHECK = 'retirar_check'
ACCION_REENVIAR_CONSTANCIA = 'reenviar_constancia'
ACCION_REGENERAR_CONSTANCIA = 'regenerar_constancia'


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
    regenerar: bool = False


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
    canal: str = 'EN_LINEA'
    registrada_por: str = ''
    registrada_por_cedula: str = ''
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
    # O39: excepción presencial «No tiene correo» (solo con justificación).
    sin_correo_alternativo: bool = False
    justificacion_sin_correo: str = ''

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

    def es_registrador(self, cedula: str) -> bool:
        """Quien llenó el acta en Registro presencial (solo aplica al canal PRESENCIAL)."""
        return (
            self.canal == Canal.PRESENCIAL.value
            and bool(self.registrada_por_cedula)
            and self.registrada_por_cedula == cedula
        )

    @property
    def registrador_tambien_aprobo(self) -> bool:
        """
        Marca de auditoría: quien registró el acta presencial también aprobó (dio un check vigente del envío
        en curso o la aprobación directa). Se deriva de las decisiones: no requiere dato persistido aparte.
        """
        if not (self.canal == Canal.PRESENCIAL.value and self.registrada_por_cedula):
            return False
        if self.dio_check(self.registrada_por_cedula):
            return True
        return any(
            d.tipo is TipoDecision.APROBACION_DIRECTA and d.envio == self.envios
            and d.actor_cedula == self.registrada_por_cedula
            for d in self.decisiones
        )

    def _exigir_no_registrador(
        self, actor: ActorRevision, registrador_puede_decidir: bool,
        admin_registradora_puede_decidir: bool = False,
    ) -> None:
        """
        Check, devolver, rechazar y retirar check. `registrador_puede_decidir` (fe_de_vida.registrador_puede_checar)
        habilita a los demás roles; la Administradora que registró usa su propio parámetro
        (`fe_de_vida.admin_registradora_puede_aprobar`), que además de la aprobación directa le abre el
        flujo normal de revisión sobre su propio registro.
        """
        if not self.es_registrador(actor.cedula):
            return
        if actor.rol is RolRevision.ADMINISTRADORA:
            if admin_registradora_puede_decidir:
                return
            raise ConflictError(MENSAJE_ADMIN_REGISTRADORA_SOLO_APROBACION)
        if not registrador_puede_decidir:
            raise ConflictError(MENSAJE_REGISTRADOR_NO_DECIDE)

    def _exigir_registrador_puede_aprobar(self, actor: ActorRevision, habilitado: bool) -> None:
        if self.es_registrador(actor.cedula) and not habilitado:
            raise ConflictError(MENSAJE_REGISTRADOR_APROBACION_DESHABILITADA)

    def acciones_disponibles(
        self, actor: ActorRevision, permisos: PermisosRevision, *, registrador_puede_checar: bool = False,
        registrador_puede_aprobar_directo: bool = False, proceso_cerrado: bool = False,
    ) -> tuple[str, ...]:
        """
        Acciones que `actor` puede ejecutar hoy sobre la solicitud (la regla vive aquí; la interfaz solo las pinta).
        Quien ya dio su check no puede dar otro, devolver ni rechazar: solo retirarlo o, si es la Administradora,
        aprobar de forma directa. Nadie revisa su propia fe de vida. Con el proceso cerrado no hay decisiones,
        pero una VALIDADA conserva reenviar y regenerar la constancia (según permisos).
        Quien registró una fe de vida presencial: la Administradora solo puede aprobar de forma directa, y únicamente
        con `registrador_puede_aprobar_directo`; los demás roles deciden solo con `registrador_puede_checar`.
        """
        if self.estado is EstadoSolicitud.VALIDADA:
            acciones_constancia = []
            if permisos.revisar:
                acciones_constancia.append(ACCION_REENVIAR_CONSTANCIA)
            if permisos.regenerar:
                acciones_constancia.append(ACCION_REGENERAR_CONSTANCIA)
            return tuple(acciones_constancia)
        if proceso_cerrado or not self.revisable or actor.cedula == self.cedula:
            return ()
        # Quien registró la fe de vida presencial no decide sobre ella, salvo lo que habiliten los parámetros:
        # la Administradora, con su parámetro, entra al flujo normal (check, devolver, rechazar) y además
        # puede aprobar de forma directa; los demás roles, el flujo normal si pueden checar.
        if self.es_registrador(actor.cedula):
            if actor.rol is RolRevision.ADMINISTRADORA:
                if not registrador_puede_aprobar_directo:
                    return ()
            elif not registrador_puede_checar:
                return ()
        if self.dio_check(actor.cedula):
            acciones = [ACCION_RETIRAR_CHECK]
            if permisos.aprobar_directo and actor.rol is RolRevision.ADMINISTRADORA:
                acciones.insert(0, ACCION_APROBAR_DIRECTO)
            return tuple(acciones)
        acciones = []
        puede_check = (
            permisos.check
            and not any(d.rol is actor.rol for d in self.checks_vigentes())
        )
        if puede_check:
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

    def dar_check(
        self, actor: ActorRevision, ahora: datetime, *, registrador_puede_checar: bool = False,
        admin_registradora_puede_decidir: bool = False,
    ) -> 'SolicitudFeDeVida':
        """
        Doble check, orden indistinto. El primero deja la solicitud en PENDIENTE_SEGUNDO_CHECK; el segundo,
        de la OTRA persona y del OTRO rol, la valida. Un check solo nunca valida (la Analista no valida sola).
        """
        self._exigir_revisable(actor)
        self._exigir_no_registrador(
            actor, registrador_puede_checar,
            admin_registradora_puede_decidir=admin_registradora_puede_decidir,
        )
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

    def aprobar_directo(
        self, actor: ActorRevision, justificacion: str, ahora: datetime, *,
        registrador_puede_aprobar_directo: bool = False,
    ) -> 'SolicitudFeDeVida':
        """
        Excepción: solo la Administradora, con justificación obligatoria (auditada). Si ella misma registró el
        acta presencial, solo puede si `registrador_puede_aprobar_directo`; no exige check previo de analista.
        """
        self._exigir_revisable(actor)
        self._exigir_registrador_puede_aprobar(actor, registrador_puede_aprobar_directo)
        if actor.rol is not RolRevision.ADMINISTRADORA:
            raise ConflictError("Solo la Administradora de Bienestar puede aprobar de forma directa.")
        if not justificacion or not justificacion.strip():
            raise ValidationError("La aprobación directa exige una justificación.", campo='justificacion')
        validar_transicion_solicitud(self.estado, EstadoSolicitud.VALIDADA)
        decision = DecisionFeDeVida(
            TipoDecision.APROBACION_DIRECTA, actor.rol, actor.cedula, self.envios, ahora, justificacion.strip(),
        )
        return replace(
            self, estado=EstadoSolicitud.VALIDADA, via_aprobacion=ViaAprobacion.DIRECTA_ADMINISTRADORA,
            decisiones=self.decisiones + (decision,), fecha_validacion=ahora,
        )

    def retirar_check(
        self, actor: ActorRevision, motivo: str, ahora: datetime, *,
        registrador_puede_checar: bool = False,
        admin_registradora_puede_decidir: bool = False,
    ) -> 'SolicitudFeDeVida':
        """
        Quien dio un check que aún no completó la validación puede retirarlo (justificación obligatoria). Si no
        queda ningún check vigente, la solicitud vuelve a PENDIENTE_REVISION. El retiro queda en el historial.
        """
        self._exigir_revisable(actor)
        self._exigir_no_registrador(
            actor, registrador_puede_checar,
            admin_registradora_puede_decidir=admin_registradora_puede_decidir,
        )
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
        *, registrador_puede_checar: bool = False,
        admin_registradora_puede_decidir: bool = False,
    ) -> 'SolicitudFeDeVida':
        self._exigir_revisable(actor)
        self._exigir_no_registrador(
            actor, registrador_puede_checar,
            admin_registradora_puede_decidir=admin_registradora_puede_decidir,
        )
        if self.dio_check(actor.cedula):
            raise ConflictError(MENSAJE_YA_DIO_CHECK)
        if not motivo or not motivo.strip():
            raise ValidationError("Debe indicar el motivo.", campo='motivo')
        validar_transicion_solicitud(self.estado, nuevo)
        decision = DecisionFeDeVida(tipo, actor.rol, actor.cedula, self.envios, ahora, motivo.strip())
        return replace(self, estado=nuevo, decisiones=self.decisiones + (decision,))

    def rechazar(
        self, actor: ActorRevision, motivo: str, ahora: datetime, *,
        registrador_puede_checar: bool = False,
        admin_registradora_puede_decidir: bool = False,
    ) -> 'SolicitudFeDeVida':
        return self._cerrar_con_motivo(
            actor, motivo, ahora, TipoDecision.RECHAZO, EstadoSolicitud.RECHAZADA,
            registrador_puede_checar=registrador_puede_checar,
            admin_registradora_puede_decidir=admin_registradora_puede_decidir,
        )

    def devolver(
        self, actor: ActorRevision, motivo: str, ahora: datetime, requiere_nueva_foto: bool = False, *,
        registrador_puede_checar: bool = False,
        admin_registradora_puede_decidir: bool = False,
    ) -> 'SolicitudFeDeVida':
        """
        Devuelta para corrección (motivo obligatorio): el pasivo corrige los datos del acta y, si el revisor lo
        pide, la foto (entonces la vigente pasa al historial). Los checks no se reutilizan al reenviar.
        """
        nueva = self._cerrar_con_motivo(
            actor, motivo, ahora, TipoDecision.DEVOLUCION, EstadoSolicitud.DEVUELTA,
            registrador_puede_checar=registrador_puede_checar,
            admin_registradora_puede_decidir=admin_registradora_puede_decidir,
        )
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
