"""
Bandeja, detalle y decisión de Dirección General sobre el ingreso (E-6). Sin Django.

  EN_DIRECCION_GENERAL -> APROBADO            (`aprobar_ingreso`): el Punto de Cuenta queda FIRMADO.
  EN_DIRECCION_GENERAL -> RECHAZADO_DIRECCION (`aprobar_ingreso`, motivo obligatorio): libera la reserva y el Punto de
                                              Cuenta queda RECHAZADO.

El histórico se arma con los Puntos de Cuenta decididos (FIRMADO/RECHAZADO), no con el estado actual: un ingreso
aprobado sigue en el histórico aunque Captación ya haya reabierto la Ventana 2 y el expediente haya avanzado.
"""
from dataclasses import replace
from datetime import date, datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente
from apps.postulacion.application.use_cases.bandeja import construir_filtros
from apps.postulacion.application.use_cases.presupuesto import ResultadoTransicion, _validar_estados_visibles
from apps.postulacion.application.use_cases.reservas import liberar_reserva_activa
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.bandeja import FiltrosBandeja
from apps.postulacion.domain.entities.punto_cuenta_ingreso import ESTADOS_DECIDIDOS, FIRMADO, RECHAZADO
from apps.postulacion.domain.entities.reserva import MOTIVO_RECHAZO_DIRECCION
from apps.postulacion.domain.errores import ConflictoConCodigo, ValidacionConCodigo
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.acciones import es_par_de_direccion
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import NotFoundError, ValidationError
from core.domain.ports import LectorConfiguracion, Notificador

E = EstadoExpediente

ESTADOS_DIRECCION: tuple[EstadoExpediente, ...] = (E.EN_DIRECCION_GENERAL, E.APROBADO, E.RECHAZADO_DIRECCION)
VISTAS_DIRECCION = ('pendientes', 'historico', 'todos')


def filtros_direccion(
    vista: str | None = None, estados: list[str] | None = None, texto: str | None = None, desde: date | None = None,
    hasta: date | None = None,
) -> FiltrosBandeja:
    """`pendientes` (EN_DIRECCION_GENERAL), `historico` (decididos) o `todos` (por defecto). Un `estado` explícito manda."""
    vista = (vista or 'todos').strip().lower()
    if vista not in VISTAS_DIRECCION:
        raise ValidationError(f"La vista debe ser una de: {', '.join(VISTAS_DIRECCION)}.", campo='vista')
    base = construir_filtros(estados, texto, desde, hasta)
    _validar_estados_visibles(base, ESTADOS_DIRECCION, 'Dirección General')
    if base.estados:
        return replace(base, prioritarios=(E.EN_DIRECCION_GENERAL,), requiere_direccion_general=True)
    return replace(
        base,
        estados=(E.EN_DIRECCION_GENERAL,) if vista in ('pendientes', 'todos') else (),
        o_punto_cuenta_estados=tuple(ESTADOS_DECIDIDOS) if vista in ('historico', 'todos') else (),
        prioritarios=(E.EN_DIRECCION_GENERAL,), requiere_direccion_general=True,   # M-1: sin Dirección General no hay bandeja
    )


def transicionar_direccion(
    repo: RepoPostulacion, config: LectorConfiguracion, notificador: Notificador | None, *, expediente_id: str,
    destino: EstadoExpediente | str, actor: Actor, motivo: str = '', ahora: datetime | None = None,
) -> ResultadoTransicion:
    try:
        destino = EstadoExpediente(destino)
    except ValueError as e:
        raise ValidacionConCodigo(
            f"El estado de destino «{destino}» no existe.", campo='destino', codigo='DESTINO_INVALIDO',
        ) from e
    ahora = ahora or ahora_utc()
    actual = obtener_expediente(repo, expediente_id)
    if not actual.es_terminal and not es_par_de_direccion(actual.estado, destino):
        raise ConflictoConCodigo(
            f"De {actual.estado.value} a {destino.value} no es una acción de Dirección General.",
            codigo='TRANSICION_NO_PERMITIDA',
        )
    with repo.transaccion():
        exp, asiento = aplicar_transicion_expediente(
            repo, config, expediente_id=expediente_id, destino=destino, actor=actor, motivo=motivo, ahora=ahora,
            notificador=notificador, datos_extra={'origen': 'direccion_general'},
        )
        punto = repo.obtener_punto_cuenta_ingreso(exp.id, bloquear=True)
        if punto is None:
            raise NotFoundError("El expediente no tiene Punto de Cuenta de ingreso: no se puede decidir.")
        repo.guardar_punto_cuenta_ingreso(replace(
            punto, estado=FIRMADO if destino == E.APROBADO else RECHAZADO, decidido_por=actor.cedula, decidido_el=ahora,
        ))
        liberada = None
        if destino == E.RECHAZADO_DIRECCION:
            liberada = liberar_reserva_activa(repo, exp.id, MOTIVO_RECHAZO_DIRECCION, ahora)
    return ResultadoTransicion(exp, asiento, actual.estado.value, reserva_liberada=liberada)
