"""
Bandeja, detalle y transiciones de Presupuesto (E-4) y emisión del Punto de Cuenta de ingreso (E-5). Sin Django.

Presupuesto solo ve los expedientes que ya llegaron a su etapa (`ESTADOS_VISIBLES_PRESUPUESTO`): los de Captación no se
le muestran ni por el detalle (404), y el detalle nunca incluye el formulario de la Ventana 1 ni los datos de contacto.

Transiciones que admite el endpoint (`PARES_PRESUPUESTO`); la máquina valida permiso, guardas y motivo:
  EN_PRESUPUESTO -> EN_CORRECCION_CARGO / DIFERIDO_PRESUPUESTO  (motivo obligatorio; libera la reserva activa)
  DIFERIDO_PRESUPUESTO -> EN_PRESUPUESTO                         («se liberó la partida»)
  EN_PRESUPUESTO -> EN_DIRECCION_GENERAL                         (exige reserva vigente y constancia; emite el Punto de Cuenta)

Todo ocurre en UNA transacción: si el Punto de Cuenta no se puede generar, el expediente no cambia de estado, y el PDF
ya subido al almacén se descarta.
"""
from dataclasses import dataclass, replace
from datetime import date, datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente
from apps.postulacion.application.use_cases.bandeja import construir_filtros
from apps.postulacion.application.use_cases.consultas import ExpedienteConHistorial, consultar_expediente
from apps.postulacion.application.use_cases.reservas import liberar_reserva_activa
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.bandeja import FilaBandeja, FiltrosBandeja, PropuestaCatalogo
from apps.postulacion.domain.entities.constancia import ConstanciaPresupuestaria
from apps.postulacion.domain.entities.postulante import TransicionRegistrada
from apps.postulacion.domain.entities.punto_cuenta_ingreso import (
    EMITIDO,
    PuntoCuentaEmitido,
    PuntoCuentaIngreso,
    SolicitudPuntoCuentaIngreso,
)
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.reserva import (
    MOTIVO_DEVOLUCION,
    MOTIVO_DIFERIDO,
    ReservaPuesto,
)
from apps.postulacion.domain.entities.vacantes import PuestoVacante
from apps.postulacion.domain.errores import ConflictoConCodigo, ValidacionConCodigo
from apps.postulacion.domain.ports.repos import CatalogoPropuesta, EmisorPuntoCuenta, PuestosVacantes, RepoPostulacion
from apps.postulacion.domain.services.acciones import (
    PARES_DIRECCION,
    PARES_PRESUPUESTO,
    AccionDisponible,
    acciones_disponibles,
    es_par_de_presupuesto,
)
from apps.postulacion.domain.services.maquina_estados import (
    P_DECLARAR_DISPONIBILIDAD,
    P_RESERVAR_PUESTO,
    Actor,
    Hechos,
)
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import NotFoundError, ValidationError
from core.domain.paginacion import Paginacion
from core.domain.ports import LectorConfiguracion, Notificador

E = EstadoExpediente

# Lo que ya pasó por Presupuesto (o está en él). Los anteriores son de Captación; EXPIRADO y RECHAZADO_CAPTACION nunca llegaron.
ESTADOS_PENDIENTES_PRESUPUESTO: tuple[EstadoExpediente, ...] = (
    E.EN_PRESUPUESTO, E.DIFERIDO_PRESUPUESTO, E.EN_CORRECCION_CARGO,
)
ESTADOS_VISIBLES_PRESUPUESTO: tuple[EstadoExpediente, ...] = ESTADOS_PENDIENTES_PRESUPUESTO + (
    E.EN_DIRECCION_GENERAL, E.RECHAZADO_DIRECCION, E.APROBADO, E.CONSOLIDANDO, E.EN_REVISION_FINAL,
    E.LISTO_PARA_ASIGNAR, E.CONTRATADO, E.DESISTIDO,
)
VISTAS_PRESUPUESTO = ('pendientes', 'todos')


@dataclass(frozen=True)
class FilaEnriquecida:
    fila: FilaBandeja
    reserva: ReservaPuesto | None = None
    constancia: ConstanciaPresupuestaria | None = None
    punto_cuenta: PuntoCuentaIngreso | None = None


def _validar_estados_visibles(
    filtros: FiltrosBandeja, permitidos: tuple[EstadoExpediente, ...], area: str,
) -> None:
    for e in filtros.estados:
        if e not in permitidos:
            raise ValidationError(f"El estado «{e.value}» no se consulta en {area}.", campo='estado')


def filtros_presupuesto(
    vista: str | None = None, estados: list[str] | None = None, texto: str | None = None, desde: date | None = None,
    hasta: date | None = None,
) -> FiltrosBandeja:
    """`vista`: `pendientes` (EN_PRESUPUESTO, DIFERIDO y EN_CORRECCION_CARGO; por defecto) o `todos`. Un `estado` explícito manda."""
    vista = (vista or 'pendientes').strip().lower()
    if vista not in VISTAS_PRESUPUESTO:
        raise ValidationError(f"La vista debe ser una de: {', '.join(VISTAS_PRESUPUESTO)}.", campo='vista')
    base = construir_filtros(estados, texto, desde, hasta)
    _validar_estados_visibles(base, ESTADOS_VISIBLES_PRESUPUESTO, 'Presupuesto')
    elegidos = base.estados or (ESTADOS_PENDIENTES_PRESUPUESTO if vista == 'pendientes' else ESTADOS_VISIBLES_PRESUPUESTO)
    return replace(base, estados=tuple(elegidos), prioritarios=(E.EN_PRESUPUESTO,))


def enriquecer_filas(repo: RepoPostulacion, filas: list[FilaBandeja]) -> list[FilaEnriquecida]:
    """Reserva, constancia y Punto de Cuenta de la página, en tres consultas (no una por fila)."""
    ids = [f.expediente.id for f in filas]
    if not ids:
        return []
    reservas, constancias, puntos = repo.reservas_activas_de(ids), repo.constancias_de(ids), repo.puntos_cuenta_de(ids)
    return [FilaEnriquecida(f, reservas.get(f.expediente.id), constancias.get(f.expediente.id), puntos.get(f.expediente.id))
            for f in filas]


def listar_bandeja_enriquecida(
    repo: RepoPostulacion, filtros: FiltrosBandeja, paginacion: Paginacion,
) -> tuple[list[FilaEnriquecida], int]:
    filas, total = repo.listar_bandeja(filtros, paginacion)
    return enriquecer_filas(repo, filas), total


@dataclass(frozen=True)
class DetalleArea:
    """Detalle de un expediente para Presupuesto o Dirección General (sin Ventana 1 ni contacto del postulante)."""

    base: ExpedienteConHistorial
    propuesta_nombres: dict[str, str]
    reserva: ReservaPuesto | None
    puesto: PuestoVacante | None
    constancia: ConstanciaPresupuestaria | None
    punto_cuenta: PuntoCuentaIngreso | None
    acciones: list[AccionDisponible]
    puede_reservar: bool = False
    puede_declarar: bool = False


def _propuesta_catalogo(exp: ExpedientePostulacion) -> PropuestaCatalogo:
    return PropuestaCatalogo(
        cargo_propuesto_id=exp.cargo_propuesto_id, cargo_especifico_propuesto_id=exp.cargo_especifico_propuesto_id,
        tipo_nomina_propuesto_id=exp.tipo_nomina_propuesto_id, direccion_general_id=exp.direccion_general_id,
        direccion_linea_id=exp.direccion_linea_id, coordinacion_id=exp.coordinacion_id, dependencia_id=exp.dependencia_id,
    )


def exigir_visible(exp: ExpedientePostulacion, punto: PuntoCuentaIngreso | None, area: str) -> None:
    """404 si el expediente no es de esa área: Presupuesto no ve los de Captación; Dirección General solo los que le llegaron."""
    if area == 'presupuesto':
        if exp.estado not in ESTADOS_VISIBLES_PRESUPUESTO:
            raise NotFoundError("El expediente no está en la etapa de Presupuesto.")
    elif exp.estado != E.EN_DIRECCION_GENERAL and punto is None:
        raise NotFoundError("El expediente no está en la etapa de Dirección General.")


def detalle_area(
    repo: RepoPostulacion, puestos: PuestosVacantes, catalogo: CatalogoPropuesta, *, expediente_id: str,
    permisos: frozenset[str], area: str, ahora: datetime | None = None,
) -> DetalleArea:
    """`area`: `presupuesto` o `direccion`. Las acciones salen de la máquina para ESTE usuario (permisos + guardas reales)."""
    ahora = ahora or ahora_utc()
    base = consultar_expediente(repo, expediente_id)
    exp = base.expediente
    punto = repo.obtener_punto_cuenta_ingreso(exp.id)
    exigir_visible(exp, punto, area)
    reserva = repo.obtener_reserva_activa_de_expediente(exp.id)
    constancia = repo.obtener_constancia(exp.id)
    puesto_id = reserva.puesto_id if reserva else (punto.puesto_id if punto else None)
    puesto = puestos.obtener_puesto(puesto_id) if puesto_id else None
    hechos = Hechos(
        ahora=ahora, ventana_vence_el=exp.ventana_vence_el, reserva_vence_el=exp.reserva_vence_el,
        diferido_vence_el=exp.diferido_vence_el, cargo_definido=exp.cargo_definido, oficina_definida=exp.oficina_definida,
        disponibilidad_declarada=constancia is not None,
        puesto_reservado=reserva is not None and reserva.vigente(ahora),
    )
    en_presupuesto = exp.estado == E.EN_PRESUPUESTO and area == 'presupuesto'
    return DetalleArea(
        base=base, propuesta_nombres=catalogo.nombres_de_propuesta(_propuesta_catalogo(exp)), reserva=reserva,
        puesto=puesto, constancia=constancia, punto_cuenta=punto,
        acciones=acciones_disponibles(
            exp, permisos, hechos, None, PARES_PRESUPUESTO if area == 'presupuesto' else PARES_DIRECCION,
        ),
        puede_reservar=en_presupuesto and P_RESERVAR_PUESTO in permisos,
        puede_declarar=en_presupuesto and P_DECLARAR_DISPONIBILIDAD in permisos,
    )


def documento_punto_cuenta(repo: RepoPostulacion, *, expediente_id: str, area: str) -> tuple[PuntoCuentaIngreso, str]:
    """El enlace con su PDF y el número del expediente, para servir la descarga; 404 si no hay Punto de Cuenta."""
    exp = obtener_expediente(repo, expediente_id)
    punto = repo.obtener_punto_cuenta_ingreso(exp.id)
    exigir_visible(exp, punto, area)
    if punto is None or not punto.pdf_clave:
        raise NotFoundError("El expediente no tiene Punto de Cuenta de ingreso.")
    return punto, exp.numero


def adjunto_constancia(repo: RepoPostulacion, *, expediente_id: str, area: str) -> tuple[ConstanciaPresupuestaria, str]:
    """La constancia y el número del expediente, para servir el PDF; 404 si no hay adjunto."""
    exp = obtener_expediente(repo, expediente_id)
    exigir_visible(exp, repo.obtener_punto_cuenta_ingreso(exp.id), area)
    c = repo.obtener_constancia(exp.id)
    if c is None or not c.tiene_adjunto:
        raise NotFoundError("La constancia presupuestaria no tiene adjunto.")
    return c, exp.numero


@dataclass(frozen=True)
class QuienActua:
    """El usuario que actúa, para la constancia y el Punto de Cuenta (cédula, nombre y id de cuenta)."""

    cedula: str
    nombre: str
    usuario_id: int | None = None


@dataclass(frozen=True)
class ResultadoTransicion:
    expediente: ExpedientePostulacion
    asiento: TransicionRegistrada | None
    origen: str
    punto_cuenta: PuntoCuentaEmitido | None = None
    reserva_liberada: ReservaPuesto | None = None


_MOTIVO_LIBERACION = {E.EN_CORRECCION_CARGO: MOTIVO_DEVOLUCION, E.DIFERIDO_PRESUPUESTO: MOTIVO_DIFERIDO}


def transicionar_presupuesto(
    repo: RepoPostulacion, config: LectorConfiguracion, puestos: PuestosVacantes, emisor: EmisorPuntoCuenta,
    notificador: Notificador | None, *, expediente_id: str, destino: EstadoExpediente | str, actor: Actor,
    quien: QuienActua, motivo: str = '', ahora: datetime | None = None,
) -> ResultadoTransicion:
    """Los errores son `DomainError` con `codigo` en español (TRANSICION_NO_PERMITIDA, SIN_PERMISO, MOTIVO_OBLIGATORIO,
    PUESTO_Y_DISPONIBILIDAD_REQUERIDOS, EXPEDIENTE_FINAL, DESTINO_INVALIDO...)."""
    try:
        destino = EstadoExpediente(destino)
    except ValueError as e:
        raise ValidacionConCodigo(
            f"El estado de destino «{destino}» no existe.", campo='destino', codigo='DESTINO_INVALIDO',
        ) from e
    ahora = ahora or ahora_utc()
    actual = obtener_expediente(repo, expediente_id)
    # Un expediente final lo rechaza la máquina con su mensaje propio (EXPEDIENTE_FINAL).
    if not actual.es_terminal and not es_par_de_presupuesto(actual.estado, destino):
        raise ConflictoConCodigo(
            f"De {actual.estado.value} a {destino.value} no es una acción de Presupuesto.", codigo='TRANSICION_NO_PERMITIDA',
        )
    emitidos: list[PuntoCuentaEmitido] = []

    def emitir(previo: ExpedientePostulacion, nuevo: ExpedientePostulacion) -> dict:
        reserva = repo.obtener_reserva_activa_de_expediente(previo.id, bloquear=True)
        constancia = repo.obtener_constancia(previo.id)
        if reserva is None or constancia is None:  # la guarda ya lo exigió; defensa ante una carrera
            raise ConflictoConCodigo(
                "Para emitir el Punto de Cuenta se requiere el puesto reservado y la disponibilidad declarada.",
                codigo='PUESTO_Y_DISPONIBILIDAD_REQUERIDOS',
            )
        puesto = puestos.obtener_puesto(reserva.puesto_id)
        postulante = repo.obtener_postulante(previo.postulante_id)
        if puesto is None or postulante is None:
            raise ConflictoConCodigo("El puesto reservado o el postulante ya no existen.", codigo='PUESTO_NO_ENCONTRADO')
        emitido = emisor.emitir_ingreso(SolicitudPuntoCuentaIngreso(
            expediente_numero=previo.numero, postulante_cedula=postulante.cedula,
            postulante_nombre=f'{postulante.nombres} {postulante.apellidos}'.strip(), puesto_id=puesto.id,
            puesto_codigo=puesto.codigo, cargo_nombre=puesto.cargo_nombre, dependencia_id=puesto.dependencia_id,
            dependencia_nombre=puesto.dependencia_nombre, direccion_general_id=puesto.direccion_general_id,
            direccion_general_nombre=puesto.direccion_general_nombre, direccion_linea_id=puesto.direccion_linea_id,
            direccion_linea_nombre=puesto.direccion_linea_nombre, referencia_constancia=constancia.referencia,
            emitido_por_cedula=quien.cedula, emitido_por_nombre=quien.nombre, emitido_por_usuario_id=quien.usuario_id,
            ahora=ahora,
        ))
        emitidos.append(emitido)
        repo.guardar_punto_cuenta_ingreso(PuntoCuentaIngreso(
            expediente_id=previo.id, punto_cuenta_id=emitido.punto_cuenta_id, numero=emitido.numero,
            pdf_clave=emitido.pdf_clave, estado=EMITIDO, puesto_id=puesto.id,
            referencia_constancia=constancia.referencia, emitido_por=quien.cedula, emitido_el=ahora,
        ))
        # La reserva vence igual que el expediente (lo fija el efecto de entrar a Dirección General): Dirección General
        # recibe el plazo completo, y la tarea programada y la guarda de asignación leen la misma fecha.
        repo.guardar_reserva(replace(reserva, vence_el=nuevo.reserva_vence_el or reserva.vence_el))
        return {
            'punto_cuenta': {'id': emitido.punto_cuenta_id, 'numero': emitido.numero},
            'puesto_id': puesto.id, 'referencia_constancia': constancia.referencia,
        }

    try:
        with repo.transaccion():
            exp, asiento = aplicar_transicion_expediente(
                repo, config, expediente_id=expediente_id, destino=destino, actor=actor, motivo=motivo, ahora=ahora,
                notificador=notificador, datos_extra={'origen': 'presupuesto'},
                antes_de_guardar=emitir if destino == E.EN_DIRECCION_GENERAL else None,
            )
            liberada = None
            if destino in _MOTIVO_LIBERACION:
                liberada = liberar_reserva_activa(repo, exp.id, _MOTIVO_LIBERACION[destino], ahora)
    except Exception:
        for e in emitidos:  # el registro del Punto de Cuenta se revirtió: no dejar su PDF huérfano
            emisor.descartar(e.punto_cuenta_id, e.pdf_clave)
        raise
    return ResultadoTransicion(
        exp, asiento, actual.estado.value, punto_cuenta=emitidos[0] if emitidos else None, reserva_liberada=liberada,
    )
