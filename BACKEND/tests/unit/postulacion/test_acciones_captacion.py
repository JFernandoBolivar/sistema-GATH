"""Acciones disponibles de Captación: salen de la máquina de estados y de los permisos (puro, sin BD)."""
from datetime import datetime, timezone

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.services.acciones import PARES_CAPTACION, acciones_disponibles
from apps.postulacion.domain.services.maquina_estados import Hechos
from apps.postulacion.domain.value_objects.estados import EstadoExpediente as E

AHORA = datetime(2026, 11, 21, 12, tzinfo=timezone.utc)
TODOS = frozenset({
    'postulacion.verificar', 'postulacion.rechazar', 'postulacion.abrir_expediente', 'postulacion.revision_final',
})


def exp(estado):
    return ExpedientePostulacion(id='1', numero='EXP-2026-00001', postulante_id='2', estado=estado)


def hechos(registrado=False, obligatorio=True):
    return Hechos(ahora=AHORA, psicofisico_obligatorio=obligatorio, psicofisico_registrado=registrado)


def por_destino(acciones):
    return {a.destino: a for a in acciones}


def test_solo_ofrece_lo_que_el_permiso_habilita():
    a = por_destino(acciones_disponibles(exp(E.ENVIADO_CAPTACION), frozenset({'postulacion.rechazar'}), hechos(), None))
    assert set(a) == {'RECHAZADO_CAPTACION'} and a['RECHAZADO_CAPTACION'].requiere_motivo
    assert acciones_disponibles(exp(E.ENVIADO_CAPTACION), frozenset(), hechos(), None) == []


def test_abrir_se_bloquea_sin_psicofisico_obligatorio_y_se_libera_al_registrarlo():
    a = por_destino(acciones_disponibles(exp(E.ENVIADO_CAPTACION), TODOS, hechos(), None))
    assert a['EN_PRESUPUESTO'].bloqueada and a['EN_PRESUPUESTO'].requiere_propuesta and not a['EN_PRESUPUESTO'].requiere_motivo
    a = por_destino(acciones_disponibles(exp(E.ENVIADO_CAPTACION), TODOS, hechos(registrado=True), None))
    assert not a['EN_PRESUPUESTO'].bloqueada
    a = por_destino(acciones_disponibles(exp(E.ENVIADO_CAPTACION), TODOS, hechos(obligatorio=False), None))
    assert not a['EN_PRESUPUESTO'].bloqueada


def test_no_apto_sugiere_rechazar_sin_bloquear():
    r = ResultadoPsicofisico(expediente_id='1', resultado='NO_APTO', fecha_aplicacion=AHORA.date())
    a = por_destino(acciones_disponibles(exp(E.ENVIADO_CAPTACION), TODOS, hechos(registrado=True), r))
    assert a['RECHAZADO_CAPTACION'].sugerida and not a['RECHAZADO_CAPTACION'].bloqueada
    assert not a['EN_PRESUPUESTO'].bloqueada and not a['EN_CORRECCION_DATOS'].sugerida


def test_ventana_2_y_estados_sin_accion_de_captacion():
    assert set(por_destino(acciones_disponibles(exp(E.APROBADO), TODOS, hechos(), None))) == {'CONSOLIDANDO'}
    revision = por_destino(acciones_disponibles(exp(E.EN_REVISION_FINAL), TODOS, hechos(), None))
    assert set(revision) == {'CONSOLIDANDO', 'LISTO_PARA_ASIGNAR'} and revision['CONSOLIDANDO'].requiere_motivo
    for estado in (E.EN_CAPTURA, E.EN_PRESUPUESTO, E.EN_DIRECCION_GENERAL, E.CONTRATADO, E.RECHAZADO_CAPTACION):
        assert acciones_disponibles(exp(estado), TODOS, hechos(), None) == []


def test_los_pares_de_captacion_son_transiciones_legales_de_la_maquina():
    from apps.postulacion.domain.services.maquina_estados import buscar_transicion
    for origen, destino in PARES_CAPTACION:
        assert buscar_transicion(origen, destino) is not None
