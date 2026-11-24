"""Presupuesto y Dirección General (bloque E): acciones, guardas, filtros de bandeja, vacantes y avisos. Puro, sin BD."""
from datetime import datetime, timedelta, timezone

import pytest

from apps.postulacion.application.use_cases.avisos import solicitudes_de_transicion
from apps.postulacion.application.use_cases.direccion import filtros_direccion
from apps.postulacion.application.use_cases.presupuesto import (
    ESTADOS_PENDIENTES_PRESUPUESTO,
    ESTADOS_VISIBLES_PRESUPUESTO,
    filtros_presupuesto,
)
from apps.postulacion.application.use_cases.reservas import FiltrosVacantesEntrada, filtro_de_vacantes
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante
from apps.postulacion.domain.entities.reserva import ReservaPuesto
from apps.postulacion.domain.services.acciones import (
    PARES_CAPTACION,
    PARES_DIRECCION,
    PARES_PRESUPUESTO,
    acciones_disponibles,
)
from apps.postulacion.domain.services.maquina_estados import (
    Actor,
    Guarda,
    Hechos,
    buscar_transicion,
    guarda_incumplida,
    validar_transicion,
)
from apps.postulacion.domain.value_objects.estados import EstadoExpediente as E
from core.domain.exceptions import DomainError, ValidationError

AHORA = datetime(2026, 11, 24, 12, tzinfo=timezone.utc)
PRESUPUESTO = frozenset({
    'postulacion.devolver_solicitud', 'postulacion.declarar_disponibilidad', 'postulacion.emitir_punto_cuenta',
})
DIRECCION = frozenset({'postulacion.aprobar_ingreso'})


def exp(estado, **campos):
    return ExpedientePostulacion(id='e1', numero='EXP-2026-00001', postulante_id='p1', estado=estado, **campos)


def hechos(reservado=False, declarada=False):
    return Hechos(ahora=AHORA, puesto_reservado=reservado, disponibilidad_declarada=declarada)


def por_destino(acciones):
    return {a.destino: a for a in acciones}


# --- acciones calculadas por la máquina ---
def test_los_pares_de_presupuesto_y_direccion_son_transiciones_legales_y_no_se_pisan_con_captacion():
    for pares in (PARES_PRESUPUESTO, PARES_DIRECCION):
        for origen, destino in pares:
            assert buscar_transicion(origen, destino) is not None, (origen, destino)
    assert set(PARES_PRESUPUESTO) & set(PARES_CAPTACION) == set()
    assert set(PARES_DIRECCION) & set(PARES_CAPTACION) == set()
    assert set(PARES_PRESUPUESTO) & set(PARES_DIRECCION) == set()
    assert len(PARES_PRESUPUESTO) == 4 and len(PARES_DIRECCION) == 2


def test_acciones_de_presupuesto_segun_permiso_y_guardas_reales():
    a = por_destino(acciones_disponibles(exp(E.EN_PRESUPUESTO), PRESUPUESTO, hechos(), pares=PARES_PRESUPUESTO))
    assert set(a) == {'EN_CORRECCION_CARGO', 'DIFERIDO_PRESUPUESTO', 'EN_DIRECCION_GENERAL'}
    assert a['EN_CORRECCION_CARGO'].requiere_motivo and a['DIFERIDO_PRESUPUESTO'].requiere_motivo
    assert not a['EN_DIRECCION_GENERAL'].requiere_motivo and not a['EN_CORRECCION_CARGO'].bloqueada
    assert a['EN_DIRECCION_GENERAL'].bloqueada
    # con solo la reserva se sabe QUÉ falta; con ambas se libera
    solo_reserva = por_destino(acciones_disponibles(exp(E.EN_PRESUPUESTO), PRESUPUESTO, hechos(reservado=True), pares=PARES_PRESUPUESTO))
    assert 'disponibilidad' in solo_reserva['EN_DIRECCION_GENERAL'].motivo_bloqueo
    assert 'puesto reservado' not in solo_reserva['EN_DIRECCION_GENERAL'].motivo_bloqueo
    ambas = por_destino(acciones_disponibles(exp(E.EN_PRESUPUESTO), PRESUPUESTO, hechos(True, True), pares=PARES_PRESUPUESTO))
    assert not ambas['EN_DIRECCION_GENERAL'].bloqueada
    # sin permiso no se ofrece
    assert acciones_disponibles(exp(E.EN_PRESUPUESTO), frozenset(), hechos(), pares=PARES_PRESUPUESTO) == []
    solo_emitir = acciones_disponibles(exp(E.EN_PRESUPUESTO), frozenset({'postulacion.emitir_punto_cuenta'}), hechos(), pares=PARES_PRESUPUESTO)
    assert {x.destino for x in solo_emitir} == {'EN_DIRECCION_GENERAL'}


def test_retomar_un_diferido_lo_ofrece_declarar_disponibilidad_y_los_estados_ajenos_no_tienen_acciones():
    a = acciones_disponibles(exp(E.DIFERIDO_PRESUPUESTO), PRESUPUESTO, hechos(), pares=PARES_PRESUPUESTO)
    assert [x.destino for x in a] == ['EN_PRESUPUESTO'] and a[0].etiqueta
    assert acciones_disponibles(
        exp(E.DIFERIDO_PRESUPUESTO), frozenset({'postulacion.devolver_solicitud'}), hechos(), pares=PARES_PRESUPUESTO) == []
    for estado in (E.ENVIADO_CAPTACION, E.EN_CORRECCION_CARGO, E.EN_DIRECCION_GENERAL, E.APROBADO, E.DESISTIDO):
        assert acciones_disponibles(exp(estado), PRESUPUESTO, hechos(True, True), pares=PARES_PRESUPUESTO) == []


def test_acciones_de_direccion_general():
    a = por_destino(acciones_disponibles(exp(E.EN_DIRECCION_GENERAL), DIRECCION, hechos(), pares=PARES_DIRECCION))
    assert set(a) == {'APROBADO', 'RECHAZADO_DIRECCION'}
    assert a['RECHAZADO_DIRECCION'].requiere_motivo and not a['APROBADO'].requiere_motivo
    assert not a['APROBADO'].bloqueada and not a['RECHAZADO_DIRECCION'].bloqueada
    assert acciones_disponibles(exp(E.EN_DIRECCION_GENERAL), frozenset(), hechos(), pares=PARES_DIRECCION) == []
    assert acciones_disponibles(exp(E.APROBADO), DIRECCION, hechos(), pares=PARES_DIRECCION) == []
    # Captación sigue viendo solo lo suyo (el parámetro nuevo no cambia el comportamiento previo)
    assert acciones_disponibles(exp(E.EN_DIRECCION_GENERAL), DIRECCION | PRESUPUESTO, hechos()) == []


# --- guardas ---
@pytest.mark.parametrize('reservado,declarada,debe_decir,no_debe_decir', [
    (False, False, ('puesto reservado', 'disponibilidad'), ()),
    (True, False, ('disponibilidad',), ('puesto reservado',)),
    (False, True, ('puesto reservado',), ('disponibilidad',)),
])
def test_la_guarda_de_emitir_dice_que_falta(reservado, declarada, debe_decir, no_debe_decir):
    mensaje = guarda_incumplida(Guarda.PUESTO_RESERVADO_Y_DISPONIBLE, hechos(reservado, declarada))
    assert all(t in mensaje for t in debe_decir) and not any(t in mensaje for t in no_debe_decir)
    assert guarda_incumplida(Guarda.PUESTO_RESERVADO_Y_DISPONIBLE, hechos(True, True)) is None


def test_la_maquina_valida_emitir_con_los_hechos_de_la_reserva_y_la_constancia():
    actor = Actor(cedula='1', permisos=PRESUPUESTO)
    with pytest.raises(DomainError) as e:
        validar_transicion(E.EN_PRESUPUESTO, E.EN_DIRECCION_GENERAL, actor, hechos(True, False))
    assert e.value.codigo == 'PUESTO_Y_DISPONIBILIDAD_REQUERIDOS'
    assert validar_transicion(E.EN_PRESUPUESTO, E.EN_DIRECCION_GENERAL, actor, hechos(True, True)).destino == E.EN_DIRECCION_GENERAL


def test_la_reserva_vigente_depende_del_estado_y_del_vencimiento():
    base = dict(id='r', expediente_id='e1', puesto_id=7, reservado_por='1', reservado_el=AHORA)
    assert ReservaPuesto(vence_el=AHORA + timedelta(days=1), **base).vigente(AHORA)
    assert ReservaPuesto(vence_el=AHORA, **base).vigente(AHORA)
    assert not ReservaPuesto(vence_el=AHORA - timedelta(seconds=1), **base).vigente(AHORA)
    for cerrada in ('LIBERADA', 'VENCIDA', 'CONSUMIDA'):
        assert not ReservaPuesto(vence_el=AHORA + timedelta(days=1), estado=cerrada, **base).vigente(AHORA)


# --- filtros de las bandejas ---
def test_filtros_de_presupuesto_pendientes_por_defecto_todos_y_estado_explicito():
    f = filtros_presupuesto()
    assert set(f.estados) == set(ESTADOS_PENDIENTES_PRESUPUESTO) == {E.EN_PRESUPUESTO, E.DIFERIDO_PRESUPUESTO, E.EN_CORRECCION_CARGO}
    assert f.prioritarios == (E.EN_PRESUPUESTO,)
    todos = filtros_presupuesto('todos')
    assert set(todos.estados) == set(ESTADOS_VISIBLES_PRESUPUESTO)
    for propio_de_captacion in (E.PRE_REGISTRADO, E.EN_CAPTURA, E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS, E.RECHAZADO_CAPTACION, E.EXPIRADO):
        assert propio_de_captacion not in todos.estados
    assert filtros_presupuesto('todos', ['DIFERIDO_PRESUPUESTO']).estados == (E.DIFERIDO_PRESUPUESTO,)
    assert filtros_presupuesto(texto='  ana   pérez ').texto == 'ana pérez'
    for malo in ({'vista': 'otra'}, {'estados': ['ENVIADO_CAPTACION']}, {'estados': ['NO_EXISTE']}):
        with pytest.raises(ValidationError):
            filtros_presupuesto(**malo)


def test_filtros_de_direccion_pendientes_historico_y_todos():
    todos = filtros_direccion()
    assert todos.estados == (E.EN_DIRECCION_GENERAL,) and set(todos.o_punto_cuenta_estados) == {'FIRMADO', 'RECHAZADO'}
    pendientes = filtros_direccion('pendientes')
    assert pendientes.estados == (E.EN_DIRECCION_GENERAL,) and pendientes.o_punto_cuenta_estados == ()
    historico = filtros_direccion('historico')
    assert historico.estados == () and set(historico.o_punto_cuenta_estados) == {'FIRMADO', 'RECHAZADO'}
    explicito = filtros_direccion('historico', ['APROBADO'])
    assert explicito.estados == (E.APROBADO,) and explicito.o_punto_cuenta_estados == ()
    assert todos.prioritarios == (E.EN_DIRECCION_GENERAL,)
    for malo in ({'vista': 'x'}, {'estados': ['EN_PRESUPUESTO']}):
        with pytest.raises(ValidationError):
            filtros_direccion(**malo)


# --- filtro de vacantes ---
def test_el_filtro_de_vacantes_sale_de_la_propuesta_y_los_criterios_explicitos_la_reemplazan():
    e = exp(E.EN_PRESUPUESTO, cargo_propuesto_id=10, dependencia_id=1, direccion_general_id=2, direccion_linea_id=3, coordinacion_id=4)
    f, de_propuesta = filtro_de_vacantes(e, FiltrosVacantesEntrada())
    assert de_propuesta and (f.cargo_id, f.dependencia_id, f.direccion_general_id, f.direccion_linea_id, f.coordinacion_id) == (10, 1, 2, 3, 4)
    assert f.expediente_propio_id == 'e1'
    f, de_propuesta = filtro_de_vacantes(e, FiltrosVacantesEntrada(cargo_id=99))
    assert not de_propuesta and f.cargo_id == 99 and f.direccion_general_id == 2   # la oficina sigue siendo la propuesta
    f, _ = filtro_de_vacantes(e, FiltrosVacantesEntrada(direccion_general_id=8))
    assert (f.cargo_id, f.dependencia_id, f.direccion_general_id, f.direccion_linea_id, f.coordinacion_id) == (10, None, 8, None, None)
    sin_ids = exp(E.EN_PRESUPUESTO, cargo_propuesto_texto='Chofer')
    f, _ = filtro_de_vacantes(sin_ids, FiltrosVacantesEntrada(texto='a-1'))
    assert f.cargo_id is None and f.direccion_general_id is None and f.texto == 'a-1'


# --- avisos (catálogo del bloque E) ---
def post():
    return Postulante(id='p1', cedula='12345678', nombres='Ana', apellidos='Pérez')


def avisos(origen, destino, actor=None, motivo=''):
    return solicitudes_de_transicion(
        exp(destino), post(), origen, destino, actor or Actor(cedula='1', permisos=frozenset()), 'asiento-1', motivo,
    )


def test_cada_aviso_del_bloque_e_va_al_permiso_y_enlace_correctos():
    (a,) = avisos(E.ENVIADO_CAPTACION, E.EN_PRESUPUESTO)
    assert (a.tipo, a.permiso_destino, a.enlace) == ('EXPEDIENTE_EN_PRESUPUESTO', 'postulacion.ver_solicitudes', '/presupuesto/solicitudes/e1')
    (a,) = avisos(E.EN_PRESUPUESTO, E.EN_DIRECCION_GENERAL)
    assert (a.tipo, a.permiso_destino, a.enlace) == ('EXPEDIENTE_EN_DIRECCION', 'postulacion.ver_ingresos', '/direccion/ingresos/e1')
    (a,) = avisos(E.EN_PRESUPUESTO, E.EN_CORRECCION_CARGO, motivo='Oficina inexistente')
    assert (a.tipo, a.permiso_destino, a.enlace) == ('EXPEDIENTE_CORRECCION_CARGO', 'postulacion.ver_bandeja', '/captacion/expedientes/e1')
    assert 'Oficina inexistente' in a.mensaje
    (a,) = avisos(E.EN_DIRECCION_GENERAL, E.APROBADO)
    assert (a.tipo, a.permiso_destino, a.enlace) == ('INGRESO_APROBADO', 'postulacion.ver_bandeja', '/captacion/expedientes/e1')
    assert all(x.clave == 'asiento-1' and x.ref_id == 'e1' and '12345678' not in x.mensaje for x in (a,))


def test_no_hay_aviso_al_retomar_un_diferido_ni_al_diferir_o_rechazar_y_el_del_puesto_perdido_lo_dice():
    assert avisos(E.DIFERIDO_PRESUPUESTO, E.EN_PRESUPUESTO) == []
    assert avisos(E.EN_PRESUPUESTO, E.DIFERIDO_PRESUPUESTO) == []
    assert avisos(E.EN_DIRECCION_GENERAL, E.RECHAZADO_DIRECCION, motivo='x') == []
    (a,) = avisos(E.LISTO_PARA_ASIGNAR, E.EN_PRESUPUESTO, Actor.sistema())
    assert a.tipo == 'EXPEDIENTE_EN_PRESUPUESTO' and 'se perdió' in a.mensaje
    (a,) = avisos(E.EN_CORRECCION_CARGO, E.EN_PRESUPUESTO)
    assert 'Captación abrió' in a.mensaje
