"""Efectos de una transición sobre el expediente (ventanas y reserva). Puro: no persiste nada."""
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.services.maquina_estados import Transicion
from apps.postulacion.domain.value_objects.estados import ESTADOS_TERMINALES, EstadoExpediente

E = EstadoExpediente


@dataclass(frozen=True)
class Vigencias:
    """Días de vigencia leídos de los parámetros `captacion.vigencia_*` (C-3, C-4); nunca constantes."""

    ventana1_dias: int
    ventana2_dias: int
    reserva_puesto_dias: int
    espera_diferido_dias: int  # C-10: `captacion.espera_diferido_dias`


def vencimiento_ventana1(ahora: datetime, v: Vigencias) -> datetime:
    return ahora + timedelta(days=v.ventana1_dias)


def aplicar_transicion(
    exp: ExpedientePostulacion, t: Transicion, ahora: datetime, vig: Vigencias,
) -> ExpedientePostulacion:
    """Nuevo expediente con el estado destino y los vencimientos que ese paso fija o limpia."""
    cambios: dict = {'estado': t.destino}
    if t.destino == E.EN_CORRECCION_DATOS:
        cambios.update(ventana=1, ventana_vence_el=ahora + timedelta(days=vig.ventana1_dias))
    elif t.destino == E.CONSOLIDANDO and not t.es_autotransicion:
        cambios.update(ventana=2, ventana_vence_el=ahora + timedelta(days=vig.ventana2_dias))
    elif t.destino == E.EN_DIRECCION_GENERAL:
        cambios.update(reserva_vence_el=ahora + timedelta(days=vig.reserva_puesto_dias))
    elif t.destino == E.APROBADO and t.origen == E.ENVIADO_CAPTACION:
        # M-1: sin Presupuesto ni Dirección General en el sistema, la reserva (hecha en Captación) cuenta desde la aprobación.
        cambios.update(reserva_vence_el=ahora + timedelta(days=vig.reserva_puesto_dias))
    elif t.destino in (E.RECHAZADO_DIRECCION, E.EN_PRESUPUESTO, E.CONTRATADO, E.ENVIADO_CAPTACION):
        cambios.update(reserva_vence_el=None)
    if t.destino == E.DIFERIDO_PRESUPUESTO:
        cambios.update(diferido_vence_el=ahora + timedelta(days=vig.espera_diferido_dias))
    elif t.origen == E.DIFERIDO_PRESUPUESTO:
        cambios.update(diferido_vence_el=None)
    # G-1: reabrir la Ventana 2 (desde APROBADO o por faltantes) deja pendiente el contacto con el postulante; salir de
    # CONSOLIDANDO (envía, o el estado se cierra) lo da por atendido.
    if t.destino == E.CONSOLIDANDO and not t.es_autotransicion:
        cambios.update(contacto_pendiente_desde=ahora)
    elif t.origen == E.CONSOLIDANDO and t.destino != E.CONSOLIDANDO:
        cambios.update(contacto_pendiente_desde=None)
    if t.destino in ESTADOS_TERMINALES:
        cambios.update(fecha_cierre=ahora)
    return replace(exp, **cambios)
