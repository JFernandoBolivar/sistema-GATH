"""Dominio puro de la fe de vida: transiciones, doble check, aprobación directa, prórroga (C2). Sin BD."""
from dataclasses import replace
from datetime import timedelta

import pytest

from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida, ProrrogaProceso
from apps.fe_de_vida.domain.entities.solicitud import ActorRevision, SolicitudFeDeVida
from apps.fe_de_vida.domain.services.reglas_proceso import prorroga_vigente, puede_enviar
from apps.fe_de_vida.domain.value_objects.estados import (
    TRANSICIONES_SOLICITUD,
    EstadoProceso,
    EstadoSolicitud as E,
    OrigenEvidencia,
    RolRevision,
    TipoDecision,
    ViaAprobacion,
)
from core.domain.exceptions import ConflictError, ValidationError
from tests.unit.fe_de_vida.memoria import (
    ADMINISTRADORA, AHORA, ANALISTA, APERTURA, CIERRE, OTRA_ADMINISTRADORA, OTRA_ANALISTA, PASIVO,
)


def solicitud(estado=E.BORRADOR, **kw):
    return SolicitudFeDeVida(id='s1', proceso_id='p1', cedula=PASIVO, estado=estado, **kw)


def pendiente():
    s = solicitud().con_evidencia(OrigenEvidencia.ARCHIVO, 'k/1.jpg', 'h', 'image/jpeg', 10)
    return s.enviar(AHORA)


def proceso(estado=EstadoProceso.ABIERTO):
    return ProcesoFeDeVida('p1', 'Fe de vida 2026', APERTURA, CIERRE, estado)


# ── Proceso ──
def test_proceso_exige_nombre_y_cierre_posterior():
    with pytest.raises(ValidationError):
        ProcesoFeDeVida('p', '  ', APERTURA, CIERRE)
    with pytest.raises(ValidationError):
        ProcesoFeDeVida('p', 'x', CIERRE, APERTURA)


def test_proceso_borrador_abre_y_cierra_solo_en_orden():
    p = proceso(EstadoProceso.BORRADOR)
    abierto = p.abrir('1')
    assert abierto.estado is EstadoProceso.ABIERTO and abierto.abierto_por == '1'
    cerrado = abierto.cerrar('2', AHORA)
    assert cerrado.estado is EstadoProceso.CERRADO and cerrado.fecha_cierre_real == AHORA
    for invalido in (lambda: p.cerrar('1', AHORA), lambda: cerrado.abrir('1'), lambda: abierto.abrir('1')):
        with pytest.raises(ConflictError):
            invalido()


# ── Prórroga y regla de envío ──
def prorroga(cedula='', dias=5):
    return ProrrogaProceso('x', 'p1', AHORA + timedelta(days=dias), 'motivo', '1', cedula)


def test_abierto_en_plazo_permite_enviar():
    assert puede_enviar(proceso(), [], PASIVO, AHORA)


def test_borrador_no_permite_enviar_ni_con_prorroga():
    assert not puede_enviar(proceso(EstadoProceso.BORRADOR), [prorroga()], PASIVO, AHORA)


def test_cerrado_sin_prorroga_no_permite_enviar():
    assert not puede_enviar(proceso(EstadoProceso.CERRADO), [], PASIVO, AHORA)


def test_abierto_vencido_sin_prorroga_no_permite_enviar():
    assert not puede_enviar(proceso(), [], PASIVO, CIERRE + timedelta(hours=1))


def test_prorroga_individual_solo_alcanza_a_su_cedula():
    cerrado = proceso(EstadoProceso.CERRADO)
    assert puede_enviar(cerrado, [prorroga(PASIVO)], PASIVO, AHORA)
    assert not puede_enviar(cerrado, [prorroga(PASIVO)], '999', AHORA)


def test_prorroga_general_alcanza_a_todos():
    cerrado = proceso(EstadoProceso.CERRADO)
    assert puede_enviar(cerrado, [prorroga()], PASIVO, AHORA) and puede_enviar(cerrado, [prorroga()], '999', AHORA)


def test_prorroga_vencida_no_vale_y_se_elige_la_que_mas_tarda():
    assert prorroga_vigente([prorroga(dias=-1)], PASIVO, AHORA) is None
    mayor = prorroga(dias=9)
    assert prorroga_vigente([prorroga(dias=2), mayor], PASIVO, AHORA) is mayor


def test_prorroga_exige_motivo():
    with pytest.raises(ValidationError):
        ProrrogaProceso('x', 'p1', CIERRE, ' ', '1')


# ── Solicitud: trámite del pasivo ──
def test_enviar_sin_foto_falla():
    with pytest.raises(ValidationError):
        solicitud().enviar(AHORA)


def test_enviar_con_foto_pasa_a_pendiente_revision_y_cuenta_el_envio():
    s = pendiente()
    assert s.estado is E.PENDIENTE_REVISION and s.envios == 1 and s.fecha_envio == AHORA


def test_pendiente_no_admite_nueva_foto_ni_reenvio():
    s = pendiente()
    with pytest.raises(ConflictError):
        s.con_evidencia(OrigenEvidencia.CAMARA, 'k', 'h', 'image/png', 1)
    with pytest.raises(ConflictError):
        s.enviar(AHORA)


# ── Doble check ──
def test_primer_check_deja_pendiente_segundo_check_sea_cual_sea_el_rol():
    for actor in (ANALISTA, ADMINISTRADORA):
        s = pendiente().dar_check(actor, AHORA)
        assert s.estado is E.PENDIENTE_SEGUNDO_CHECK and s.via_aprobacion is None


def test_la_analista_nunca_valida_sola():
    s = pendiente().dar_check(ANALISTA, AHORA)
    assert s.estado is not E.VALIDADA
    with pytest.raises(ConflictError):  # ni dando su check otra vez
        s.dar_check(ANALISTA, AHORA)


@pytest.mark.parametrize('primero,segundo', [(ANALISTA, ADMINISTRADORA), (ADMINISTRADORA, ANALISTA)])
def test_segundo_check_del_otro_rol_valida_en_cualquier_orden(primero, segundo):
    s = pendiente().dar_check(primero, AHORA).dar_check(segundo, AHORA)
    assert s.estado is E.VALIDADA and s.via_aprobacion is ViaAprobacion.DOBLE_CHECK and s.fecha_validacion == AHORA
    assert [d.tipo for d in s.decisiones] == [TipoDecision.CHECK, TipoDecision.CHECK]


def test_la_misma_persona_no_puede_dar_los_dos_checks():
    s = pendiente().dar_check(ADMINISTRADORA, AHORA)
    mismo_actor_otro_rol = ActorRevision(ADMINISTRADORA.cedula, RolRevision.ANALISTA)
    with pytest.raises(ConflictError, match='misma persona'):
        s.dar_check(mismo_actor_otro_rol, AHORA)


def test_dos_personas_del_mismo_rol_no_validan():
    s = pendiente().dar_check(ANALISTA, AHORA)
    with pytest.raises(ConflictError, match='otro rol'):
        s.dar_check(OTRA_ANALISTA, AHORA)
    s2 = pendiente().dar_check(ADMINISTRADORA, AHORA)
    with pytest.raises(ConflictError):
        s2.dar_check(OTRA_ADMINISTRADORA, AHORA)


def test_no_se_revisa_la_propia_fe_de_vida():
    propio = ActorRevision(PASIVO, RolRevision.ANALISTA)
    with pytest.raises(ConflictError, match='propia'):
        pendiente().dar_check(propio, AHORA)


def test_check_solo_en_estados_revisables():
    for e in (E.BORRADOR, E.VALIDADA, E.RECHAZADA, E.REPETICION_SOLICITADA, E.EXPIRADA, E.ARCHIVADA):
        with pytest.raises(ConflictError):
            solicitud(e).dar_check(ANALISTA, AHORA)


# ── Aprobación directa ──
def test_aprobacion_directa_de_la_administradora_valida_desde_ambos_estados():
    for base in (pendiente(), pendiente().dar_check(ANALISTA, AHORA)):
        s = base.aprobar_directo(ADMINISTRADORA, ' urgente, adulto mayor ', AHORA)
        assert s.estado is E.VALIDADA and s.via_aprobacion is ViaAprobacion.DIRECTA_ADMINISTRADORA
        assert s.decisiones[-1].tipo is TipoDecision.APROBACION_DIRECTA and s.decisiones[-1].motivo == 'urgente, adulto mayor'


def test_aprobacion_directa_exige_justificacion():
    for vacio in ('', '   '):
        with pytest.raises(ValidationError):
            pendiente().aprobar_directo(ADMINISTRADORA, vacio, AHORA)


def test_la_analista_no_puede_aprobar_directo():
    with pytest.raises(ConflictError, match='Administradora'):
        pendiente().aprobar_directo(ANALISTA, 'justificado', AHORA)


# ── Rechazo y repetición ──
@pytest.mark.parametrize('actor', [ANALISTA, ADMINISTRADORA])
def test_rechazo_con_motivo_desde_pendientes(actor):
    for base in (pendiente(), pendiente().dar_check(OTRA_ADMINISTRADORA, AHORA)):
        s = base.rechazar(actor, 'foto ilegible', AHORA)
        assert s.estado is E.RECHAZADA and s.decisiones[-1].tipo is TipoDecision.RECHAZO


def test_rechazo_y_repeticion_exigen_motivo():
    with pytest.raises(ValidationError):
        pendiente().rechazar(ANALISTA, ' ', AHORA)
    with pytest.raises(ValidationError):
        pendiente().solicitar_repeticion(ANALISTA, '', AHORA)


def test_repeticion_limpia_la_foto_conserva_historial_y_no_reutiliza_checks():
    s = pendiente().dar_check(ANALISTA, AHORA).solicitar_repeticion(ADMINISTRADORA, 'rostro cortado', AHORA)
    assert s.estado is E.REPETICION_SOLICITADA and s.evidencia_clave == '' and s.evidencias_previas == ('k/1.jpg',)
    with pytest.raises(ValidationError):  # sin nueva foto no puede reenviar
        s.enviar(AHORA)
    s2 = s.con_evidencia(OrigenEvidencia.CAMARA, 'k/2.jpg', 'h2', 'image/jpeg', 5).enviar(AHORA)
    assert s2.estado is E.PENDIENTE_REVISION and s2.envios == 2 and s2.checks_vigentes() == ()
    # los checks previos quedan en el historial pero un único check nuevo no valida
    assert s2.dar_check(ADMINISTRADORA, AHORA).estado is E.PENDIENTE_SEGUNDO_CHECK
    assert len([d for d in s2.decisiones if d.tipo is TipoDecision.CHECK]) == 1


# ── Máquina de estados ──
def test_expirar_solo_borrador_o_repeticion_y_rehabilitar_solo_expirada():
    assert solicitud().expirar().estado is E.EXPIRADA
    assert solicitud(E.REPETICION_SOLICITADA).expirar().estado is E.EXPIRADA
    for e in (E.PENDIENTE_REVISION, E.PENDIENTE_SEGUNDO_CHECK, E.VALIDADA, E.RECHAZADA):
        with pytest.raises(ConflictError):
            solicitud(e).expirar()
    assert solicitud(E.EXPIRADA).rehabilitar().estado is E.BORRADOR
    with pytest.raises(ConflictError):
        solicitud().rehabilitar()


def test_archivar_solo_validada_y_rechazada_es_terminal():
    assert solicitud(E.VALIDADA).archivar().estado is E.ARCHIVADA
    with pytest.raises(ConflictError):
        solicitud(E.RECHAZADA).archivar()
    assert TRANSICIONES_SOLICITUD[E.RECHAZADA] == frozenset() and TRANSICIONES_SOLICITUD[E.ARCHIVADA] == frozenset()


def test_el_estado_validada_solo_se_alcanza_desde_pendientes():
    origenes = {e for e, destinos in TRANSICIONES_SOLICITUD.items() if E.VALIDADA in destinos}
    assert origenes == {E.PENDIENTE_REVISION, E.PENDIENTE_SEGUNDO_CHECK}
    assert replace(solicitud(), id='x').id == 'x'
