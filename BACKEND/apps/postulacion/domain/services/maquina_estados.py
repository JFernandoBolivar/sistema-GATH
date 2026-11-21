"""
Máquina de estados del Expediente de Postulación (§4.2) con la matriz de autorización (§7.2). Sin Django.

Cada transición legal declara quién puede ejecutarla (permiso `postulacion.*`, el propio postulante o el
sistema) y las guardas que debe cumplir. `validar_transicion` aplica, en este orden: expediente no
terminal, transición legal, autorización del actor y guardas. Todo error es un `DomainError` con mensaje
en español.

Decisiones donde §4.2, §7.2 y el catálogo de permisos sembrado no coinciden o no alcanzan:

1. Estados: el diagrama dibuja 17, no 16 (ver `estados.py`); se implementan los 17.
2. Permiso por transición: §7.2 habla de roles; se traduce a los permisos sembrados así:
   Captación -> verificar (devolver con observaciones), rechazar, abrir_expediente (abrir y reabrir hacia
   Presupuesto), revision_final (Ventana 2, revisión final y asignación); Presupuesto -> devolver_solicitud
   (devolver por cargo y diferir), declarar_disponibilidad (retomar un diferido al liberarse la partida),
   emitir_punto_cuenta (pasar a Dirección General); Dirección General -> aprobar_ingreso (aprobar y rechazar).
3. «Evaluar el test» (§7.2) y «Reservar puesto / Registrar constancia» no son transiciones del expediente: son
   hechos externos (`registrar_psicofisico`, `reservar_puesto`, `declarar_disponibilidad`). La máquina los
   recibe como `Hechos` y los exige como guardas.
4. Psicofísico (C-6): `captacion.psicofisico_obligatorio` decide si ENVIADO_CAPTACION -> EN_PRESUPUESTO exige
   el resultado registrado; si es falso, avanza sin él.
5. Vencimientos: PRE_REGISTRADO/EN_CAPTURA -> EXPIRADO solo ocurren cuando la ventana ya venció y las
   ejecuta el SISTEMA (tarea programada). El postulante no puede actuar con la ventana vencida.
6. Observar/devolver reabre la ventana del postulante (EN_CORRECCION_DATOS: V1; EN_REVISION_FINAL ->
   CONSOLIDANDO: V2) para que pueda corregir; §4.2 no dibuja expiración desde EN_CORRECCION_DATOS, así que
   la ventana reabierta vence por la regla del punto 5 solo mientras el expediente siga en estados de ventana.
7. DIFERIDO_PRESUPUESTO -> DESISTIDO («caduca la espera», C-10): la ejecuta el SISTEMA y solo cuando venció el
   plazo `captacion.espera_diferido_dias` (90 por defecto). Al entrar en DIFERIDO_PRESUPUESTO se fija
   `diferido_vence_el` (ahora + días del parámetro) y se limpia al salir; la guarda ESPERA_DIFERIDO_VENCIDA
   exige `ahora > diferido_vence_el`, igual que la ventana vencida con `ventana_vence_el`.
8. LISTO_PARA_ASIGNAR -> EN_PRESUPUESTO («el puesto se perdió»): lo ejecuta el SISTEMA o Captación
   (revision_final) y solo si la reserva venció o el puesto ya no se revalida.
9. Autotransiciones (EN_CAPTURA y CONSOLIDANDO guardan borrador): son legales con el postulante y la ventana
   vigente, pero NO generan asiento en el historial (serían ruido por cada guardado).
10. Un postulante tiene como mucho un expediente abierto; un terminal es inmutable (ver constraint del ORM).
"""
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from apps.postulacion.domain.value_objects.estados import (
    ACTOR_POSTULANTE,
    ACTOR_SISTEMA,
    ACTOR_USUARIO,
    ESTADOS_TERMINALES,
    EstadoExpediente,
)
from apps.postulacion.domain.errores import ConflictoConCodigo, SinPermisoConCodigo, ValidacionConCodigo
from core.domain.exceptions import DomainError

E = EstadoExpediente

# Permisos `postulacion.*` sembrados en `seed_permisos` (códigos exactos).
P_VERIFICAR = 'postulacion.verificar'
P_RECHAZAR = 'postulacion.rechazar'
P_ABRIR_EXPEDIENTE = 'postulacion.abrir_expediente'
P_REVISION_FINAL = 'postulacion.revision_final'
P_DEVOLVER_SOLICITUD = 'postulacion.devolver_solicitud'
P_DECLARAR_DISPONIBILIDAD = 'postulacion.declarar_disponibilidad'
P_EMITIR_PUNTO_CUENTA = 'postulacion.emitir_punto_cuenta'
P_APROBAR_INGRESO = 'postulacion.aprobar_ingreso'


class Guarda(str, Enum):
    VENTANA_VIGENTE = 'VENTANA_VIGENTE'
    VENTANA_VENCIDA = 'VENTANA_VENCIDA'
    MOTIVO_OBLIGATORIO = 'MOTIVO_OBLIGATORIO'
    PSICOFISICO = 'PSICOFISICO'
    CARGO_Y_OFICINA = 'CARGO_Y_OFICINA'
    PUESTO_RESERVADO_Y_DISPONIBLE = 'PUESTO_RESERVADO_Y_DISPONIBLE'
    RESERVA_VIGENTE_Y_REVALIDADA = 'RESERVA_VIGENTE_Y_REVALIDADA'
    PUESTO_PERDIDO = 'PUESTO_PERDIDO'
    ESPERA_DIFERIDO_VENCIDA = 'ESPERA_DIFERIDO_VENCIDA'


@dataclass(frozen=True)
class Actor:
    """Quien ejecuta: un usuario con permisos, el postulante (invitado) o el sistema (tareas programadas)."""

    cedula: str = ''
    permisos: frozenset[str] = frozenset()
    tipo: str = ACTOR_USUARIO

    @classmethod
    def postulante(cls, cedula: str) -> 'Actor':
        return cls(cedula=cedula, tipo=ACTOR_POSTULANTE)

    @classmethod
    def sistema(cls) -> 'Actor':
        return cls(tipo=ACTOR_SISTEMA)


@dataclass(frozen=True)
class Hechos:
    """Datos del momento que las guardas necesitan. Lo que aún no tiene tabla propia (psicofísico, reserva,
    constancia presupuestaria) llega ya resuelto desde quien invoca; por defecto es «no cumplido»."""

    ahora: datetime
    ventana_vence_el: datetime | None = None
    reserva_vence_el: datetime | None = None
    diferido_vence_el: datetime | None = None
    cargo_definido: bool = False
    oficina_definida: bool = False
    psicofisico_obligatorio: bool = True
    psicofisico_registrado: bool = False
    disponibilidad_declarada: bool = False
    puesto_reservado: bool = False
    puesto_revalidado: bool = False


@dataclass(frozen=True)
class Transicion:
    origen: EstadoExpediente
    destino: EstadoExpediente
    permisos: tuple[str, ...] = ()       # basta uno de ellos
    postulante: bool = False             # el propio postulante puede ejecutarla
    sistema: bool = False                # una tarea programada puede ejecutarla
    guardas: tuple[Guarda, ...] = ()
    registra_historial: bool = True

    @property
    def es_autotransicion(self) -> bool:
        return self.origen == self.destino


def _t(origen, destino, *, permisos=(), postulante=False, sistema=False, guardas=(), registra_historial=True):
    return Transicion(origen, destino, tuple(permisos), postulante, sistema, tuple(guardas), registra_historial)


G = Guarda

TRANSICIONES: tuple[Transicion, ...] = (
    # Ventana 1
    _t(E.PRE_REGISTRADO, E.EN_CAPTURA, postulante=True, guardas=[G.VENTANA_VIGENTE]),
    _t(E.PRE_REGISTRADO, E.EXPIRADO, sistema=True, guardas=[G.VENTANA_VENCIDA]),
    _t(E.EN_CAPTURA, E.EN_CAPTURA, postulante=True, guardas=[G.VENTANA_VIGENTE], registra_historial=False),
    _t(E.EN_CAPTURA, E.ENVIADO_CAPTACION, postulante=True, guardas=[G.VENTANA_VIGENTE]),
    _t(E.EN_CAPTURA, E.EXPIRADO, sistema=True, guardas=[G.VENTANA_VENCIDA]),
    # Captación verifica
    _t(E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS, permisos=[P_VERIFICAR], guardas=[G.MOTIVO_OBLIGATORIO]),
    _t(E.EN_CORRECCION_DATOS, E.ENVIADO_CAPTACION, postulante=True, guardas=[G.VENTANA_VIGENTE]),
    _t(E.ENVIADO_CAPTACION, E.RECHAZADO_CAPTACION, permisos=[P_RECHAZAR], guardas=[G.MOTIVO_OBLIGATORIO]),
    _t(E.ENVIADO_CAPTACION, E.EN_PRESUPUESTO, permisos=[P_ABRIR_EXPEDIENTE],
       guardas=[G.CARGO_Y_OFICINA, G.PSICOFISICO]),
    # Presupuesto
    _t(E.EN_PRESUPUESTO, E.EN_CORRECCION_CARGO, permisos=[P_DEVOLVER_SOLICITUD], guardas=[G.MOTIVO_OBLIGATORIO]),
    _t(E.EN_CORRECCION_CARGO, E.EN_PRESUPUESTO, permisos=[P_ABRIR_EXPEDIENTE], guardas=[G.CARGO_Y_OFICINA]),
    _t(E.EN_PRESUPUESTO, E.DIFERIDO_PRESUPUESTO, permisos=[P_DEVOLVER_SOLICITUD], guardas=[G.MOTIVO_OBLIGATORIO]),
    _t(E.DIFERIDO_PRESUPUESTO, E.EN_PRESUPUESTO, permisos=[P_DECLARAR_DISPONIBILIDAD]),
    _t(E.DIFERIDO_PRESUPUESTO, E.DESISTIDO, sistema=True, guardas=[G.ESPERA_DIFERIDO_VENCIDA]),
    _t(E.EN_PRESUPUESTO, E.EN_DIRECCION_GENERAL, permisos=[P_EMITIR_PUNTO_CUENTA],
       guardas=[G.PUESTO_RESERVADO_Y_DISPONIBLE]),
    # Dirección General
    _t(E.EN_DIRECCION_GENERAL, E.RECHAZADO_DIRECCION, permisos=[P_APROBAR_INGRESO], guardas=[G.MOTIVO_OBLIGATORIO]),
    _t(E.EN_DIRECCION_GENERAL, E.APROBADO, permisos=[P_APROBAR_INGRESO]),
    # Ventana 2
    _t(E.APROBADO, E.CONSOLIDANDO, permisos=[P_REVISION_FINAL]),
    _t(E.CONSOLIDANDO, E.CONSOLIDANDO, postulante=True, guardas=[G.VENTANA_VIGENTE], registra_historial=False),
    _t(E.CONSOLIDANDO, E.EN_REVISION_FINAL, postulante=True, guardas=[G.VENTANA_VIGENTE]),
    _t(E.EN_REVISION_FINAL, E.CONSOLIDANDO, permisos=[P_REVISION_FINAL], guardas=[G.MOTIVO_OBLIGATORIO]),
    _t(E.EN_REVISION_FINAL, E.LISTO_PARA_ASIGNAR, permisos=[P_REVISION_FINAL]),
    # Asignación
    _t(E.LISTO_PARA_ASIGNAR, E.CONTRATADO, permisos=[P_REVISION_FINAL], guardas=[G.RESERVA_VIGENTE_Y_REVALIDADA]),
    _t(E.LISTO_PARA_ASIGNAR, E.EN_PRESUPUESTO, permisos=[P_REVISION_FINAL], sistema=True,
       guardas=[G.PUESTO_PERDIDO]),
)

_POR_PAR: dict[tuple[EstadoExpediente, EstadoExpediente], Transicion] = {(t.origen, t.destino): t for t in TRANSICIONES}


def transiciones_desde(origen: EstadoExpediente) -> tuple[Transicion, ...]:
    return tuple(t for t in TRANSICIONES if t.origen == origen)


def buscar_transicion(origen: EstadoExpediente, destino: EstadoExpediente) -> Transicion | None:
    return _POR_PAR.get((origen, destino))


def _exigir_autorizado(t: Transicion, actor: Actor) -> None:
    if actor.tipo == ACTOR_SISTEMA:
        autorizado = t.sistema
    elif actor.tipo == ACTOR_POSTULANTE:
        autorizado = t.postulante
    else:
        autorizado = any(p in actor.permisos for p in t.permisos)
    if not autorizado:
        if t.permisos and actor.tipo == ACTOR_USUARIO:
            raise SinPermisoConCodigo(
                f"No tiene permiso para pasar el expediente de {t.origen.value} a {t.destino.value} "
                f"(se requiere {' o '.join(t.permisos)})."
            )
        raise SinPermisoConCodigo(
            f"Este actor no puede pasar el expediente de {t.origen.value} a {t.destino.value}."
        )


def _ventana_vigente(h: Hechos) -> bool:
    return h.ventana_vence_el is not None and h.ahora <= h.ventana_vence_el


def _reserva_vigente(h: Hechos) -> bool:
    return h.reserva_vence_el is not None and h.ahora <= h.reserva_vence_el


def _evaluar_guarda(g: Guarda, h: Hechos, motivo: str) -> None:
    if g is Guarda.VENTANA_VIGENTE and not _ventana_vigente(h):
        raise ConflictoConCodigo("La ventana de acceso del postulante venció o no está vigente.", codigo="VENTANA_VENCIDA")
    if g is Guarda.VENTANA_VENCIDA and (h.ventana_vence_el is None or h.ahora <= h.ventana_vence_el):
        raise ConflictoConCodigo("El expediente no puede expirar: su ventana todavía está vigente.", codigo="VENTANA_VIGENTE")
    if g is Guarda.ESPERA_DIFERIDO_VENCIDA and (h.diferido_vence_el is None or h.ahora <= h.diferido_vence_el):
        raise ConflictoConCodigo("El expediente no puede desistirse: el plazo de espera del diferido todavía no vence.", codigo="ESPERA_DIFERIDO_VIGENTE")
    if g is Guarda.MOTIVO_OBLIGATORIO and not (motivo or '').strip():
        raise ValidacionConCodigo("Indique el motivo: es obligatorio para esta transición.", campo='motivo', codigo="MOTIVO_OBLIGATORIO")
    if g is Guarda.PSICOFISICO and h.psicofisico_obligatorio and not h.psicofisico_registrado:
        raise ConflictoConCodigo("El resultado del test psicofísico es obligatorio y todavía no está registrado.", codigo="PSICOFISICO_OBLIGATORIO")
    if g is Guarda.CARGO_Y_OFICINA and not (h.cargo_definido and h.oficina_definida):
        raise ValidacionConCodigo("Defina el cargo y la oficina propuestos antes de continuar.", codigo="CARGO_Y_OFICINA_REQUERIDOS")
    if g is Guarda.PUESTO_RESERVADO_Y_DISPONIBLE and not (h.puesto_reservado and h.disponibilidad_declarada):
        raise ConflictoConCodigo(
            "Para emitir el Punto de Cuenta se requiere el puesto reservado y la disponibilidad presupuestaria declarada.",
            codigo="PUESTO_Y_DISPONIBILIDAD_REQUERIDOS",
        )
    if g is Guarda.RESERVA_VIGENTE_Y_REVALIDADA and not (_reserva_vigente(h) and h.puesto_revalidado):
        raise ConflictoConCodigo("No se puede asignar el cargo: la reserva del puesto venció o el puesto no fue revalidado.", codigo="RESERVA_NO_VIGENTE")
    if g is Guarda.PUESTO_PERDIDO and _reserva_vigente(h) and h.puesto_revalidado:
        raise ConflictoConCodigo("El puesto reservado sigue vigente: no corresponde volver a Presupuesto.", codigo="PUESTO_VIGENTE")


def validar_transicion(
    origen: EstadoExpediente, destino: EstadoExpediente, actor: Actor, hechos: Hechos, motivo: str = '',
) -> Transicion:
    """Devuelve la transición legal o lanza un `DomainError` en español."""
    if origen in ESTADOS_TERMINALES:
        raise ConflictoConCodigo(
            f"El expediente está en un estado final ({origen.value}) y no admite cambios; "
            "para corregirlo abra uno nuevo.", codigo="EXPEDIENTE_FINAL",
        )
    t = buscar_transicion(origen, destino)
    if t is None:
        raise ConflictoConCodigo(
            f"Transición no permitida: de {origen.value} a {destino.value}.", codigo="TRANSICION_NO_PERMITIDA",
        )
    _exigir_autorizado(t, actor)
    for guarda in t.guardas:
        _evaluar_guarda(guarda, hechos, motivo)
    return t


def guarda_incumplida(g: Guarda, h: Hechos) -> str | None:
    """Mensaje de por qué la guarda no se cumple con estos hechos, o None si se cumple (sin motivo: ver `acciones`)."""
    try:
        _evaluar_guarda(g, h, 'x')
    except DomainError as e:
        return str(e)
    return None
