"""Máquina de estados del Expediente de Postulación (D-2): dominio puro, sin Django ni BD."""
from datetime import datetime, timedelta, timezone

import pytest

from apps.postulacion.domain.services.efectos import Vigencias, aplicar_transicion
from apps.postulacion.domain.services.maquina_estados import (
    TRANSICIONES,
    Actor,
    Guarda,
    Hechos,
    Transicion,
    buscar_transicion,
    validar_transicion,
)
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.value_objects.estados import (
    ESTADOS_ABIERTOS,
    ESTADOS_TERMINALES,
    EstadoExpediente,
)
from core.domain.exceptions import ConflictError, DomainError, PermissionDeniedError, ValidationError

E = EstadoExpediente
AHORA = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)
VIG = Vigencias(ventana1_dias=15, ventana2_dias=10, reserva_puesto_dias=30, espera_diferido_dias=90)


def _id(t: Transicion) -> str:
    return f'{t.origen.value}->{t.destino.value}'


def _hechos_para(t: Transicion, **cambios) -> Hechos:
    """Hechos que satisfacen todas las guardas de la transición."""
    base = dict(
        ahora=AHORA, ventana_vence_el=AHORA + timedelta(days=1), reserva_vence_el=AHORA + timedelta(days=1),
        cargo_definido=True, oficina_definida=True, psicofisico_obligatorio=True, psicofisico_registrado=True,
        disponibilidad_declarada=True, puesto_reservado=True, puesto_revalidado=True,
        # M-1: el proceso de ingreso para el que existe la transición (None = indiferente; se prueba con ambos activos).
        requiere_presupuesto=True if t.con_presupuesto is None else t.con_presupuesto,
        requiere_direccion_general=True if t.con_direccion is None else t.con_direccion,
        punto_cuenta_generado=True,
    )
    if Guarda.VENTANA_VENCIDA in t.guardas:
        base['ventana_vence_el'] = AHORA - timedelta(days=1)
    if Guarda.ESPERA_DIFERIDO_VENCIDA in t.guardas:
        base['diferido_vence_el'] = AHORA - timedelta(days=1)
    if Guarda.PUESTO_PERDIDO in t.guardas:
        base['reserva_vence_el'] = AHORA - timedelta(days=1)
    base.update(cambios)
    return Hechos(**base)


def _actor_valido(t: Transicion) -> Actor:
    if t.permisos:
        return Actor(cedula='12345678', permisos=frozenset({t.permisos[0]}))
    if t.postulante:
        return Actor.postulante('9999999')
    return Actor.sistema()


def _ejecutar(t: Transicion, actor=None, motivo='motivo de prueba', **cambios):
    return validar_transicion(t.origen, t.destino, actor or _actor_valido(t), _hechos_para(t, **cambios), motivo)


def test_hay_diecisiete_estados_y_cinco_terminales():
    assert len(E) == 17
    assert ESTADOS_TERMINALES == {E.CONTRATADO, E.RECHAZADO_CAPTACION, E.RECHAZADO_DIRECCION, E.EXPIRADO, E.DESISTIDO}
    assert len(ESTADOS_ABIERTOS) == 12


def test_con_ambos_flags_activos_siguen_las_25_transiciones_del_sistema():
    activas = [t for t in TRANSICIONES if t.aplica(True, True)]
    assert len(activas) == 25
    assert all(t.con_presupuesto is not False and t.con_direccion is not False for t in activas)
    # Las cuatro de M-1 solo existen sin Presupuesto o sin Dirección General.
    assert {_id(t) for t in TRANSICIONES if not t.aplica(True, True)} == {
        'ENVIADO_CAPTACION->EN_DIRECCION_GENERAL', 'ENVIADO_CAPTACION->APROBADO', 'EN_DIRECCION_GENERAL->APROBADO',
        'LISTO_PARA_ASIGNAR->ENVIADO_CAPTACION',
    }


def test_toda_transicion_tiene_alguien_autorizado():
    for t in TRANSICIONES:
        assert t.permisos or t.postulante or t.sistema, _id(t)


def test_los_permisos_de_la_matriz_son_codigos_postulacion_sembrados():
    from apps.identidad.management.commands.seed_permisos import PERMISOS_CATALOGO
    codigos = {c for c, _ in PERMISOS_CATALOGO}
    usados = {p for t in TRANSICIONES for p in t.permisos}
    assert usados <= codigos
    assert all(p.startswith('postulacion.') for p in usados)


@pytest.mark.parametrize('t', TRANSICIONES, ids=_id)
def test_transicion_legal_con_actor_y_hechos_validos(t):
    assert _ejecutar(t) is t


@pytest.mark.parametrize('t', [t for t in TRANSICIONES if t.permisos], ids=_id)
def test_permiso_faltante_se_rechaza(t):
    sin_permiso = Actor(cedula='1', permisos=frozenset({'postulacion.ver_bandeja'}))
    with pytest.raises(PermissionDeniedError, match='permiso'):
        _ejecutar(t, actor=sin_permiso)


@pytest.mark.parametrize('t', TRANSICIONES, ids=_id)
def test_el_postulante_solo_ejecuta_sus_transiciones(t):
    if t.postulante:
        assert _ejecutar(t, actor=Actor.postulante('1')) is t
    else:
        with pytest.raises(PermissionDeniedError):
            _ejecutar(t, actor=Actor.postulante('1'))


@pytest.mark.parametrize('t', TRANSICIONES, ids=_id)
def test_el_sistema_solo_ejecuta_sus_transiciones(t):
    if t.sistema:
        assert _ejecutar(t, actor=Actor.sistema()) is t
    else:
        with pytest.raises(PermissionDeniedError):
            _ejecutar(t, actor=Actor.sistema())


def test_un_usuario_con_todos_los_permisos_no_hace_lo_del_postulante_ni_del_sistema():
    todos = frozenset(p for t in TRANSICIONES for p in t.permisos)
    t = buscar_transicion(E.PRE_REGISTRADO, E.EN_CAPTURA)
    with pytest.raises(PermissionDeniedError):
        _ejecutar(t, actor=Actor(cedula='1', permisos=todos))


_LEGALES = {(t.origen, t.destino) for t in TRANSICIONES}
_ILEGALES = [(o, d) for o in E for d in E if (o, d) not in _LEGALES]


@pytest.mark.parametrize('origen,destino', _ILEGALES, ids=[f'{o.value}->{d.value}' for o, d in _ILEGALES])
def test_transicion_ilegal_se_rechaza_con_mensaje_en_espanol(origen, destino):
    actor = Actor(cedula='1', permisos=frozenset(p for t in TRANSICIONES for p in t.permisos))
    with pytest.raises(ConflictError) as exc:
        validar_transicion(origen, destino, actor, Hechos(ahora=AHORA), 'motivo')
    assert isinstance(exc.value, DomainError)
    assert 'final' in str(exc.value) or 'no permitida' in str(exc.value)


@pytest.mark.parametrize('terminal', sorted(ESTADOS_TERMINALES, key=lambda e: e.value))
def test_un_terminal_es_inmutable(terminal):
    todos = Actor(cedula='1', permisos=frozenset(p for t in TRANSICIONES for p in t.permisos))
    for destino in E:
        with pytest.raises(ConflictError, match='estado final'):
            validar_transicion(terminal, destino, todos, Hechos(ahora=AHORA), 'm')


_RECHAZOS = [
    (E.ENVIADO_CAPTACION, E.RECHAZADO_CAPTACION),
    (E.EN_DIRECCION_GENERAL, E.RECHAZADO_DIRECCION),
]


@pytest.mark.parametrize('origen,destino', _RECHAZOS)
@pytest.mark.parametrize('motivo', ['', '   ', None])
def test_el_rechazo_exige_motivo(origen, destino, motivo):
    t = buscar_transicion(origen, destino)
    with pytest.raises(ValidationError, match='motivo'):
        _ejecutar(t, motivo=motivo)


@pytest.mark.parametrize('t', [t for t in TRANSICIONES if Guarda.MOTIVO_OBLIGATORIO in t.guardas], ids=_id)
def test_las_devoluciones_y_rechazos_exigen_motivo(t):
    with pytest.raises(ValidationError):
        _ejecutar(t, motivo=' ')


@pytest.mark.parametrize('obligatorio,registrado,pasa', [
    (True, True, True), (True, False, False), (False, False, True), (False, True, True),
])
def test_psicofisico_segun_parametro_c6(obligatorio, registrado, pasa):
    t = buscar_transicion(E.ENVIADO_CAPTACION, E.EN_PRESUPUESTO)
    if pasa:
        assert _ejecutar(t, psicofisico_obligatorio=obligatorio, psicofisico_registrado=registrado) is t
    else:
        with pytest.raises(ConflictError, match='psicofísico'):
            _ejecutar(t, psicofisico_obligatorio=obligatorio, psicofisico_registrado=registrado)


@pytest.mark.parametrize('cargo,oficina', [(False, True), (True, False), (False, False)])
def test_abrir_expediente_exige_cargo_y_oficina(cargo, oficina):
    t = buscar_transicion(E.ENVIADO_CAPTACION, E.EN_PRESUPUESTO)
    with pytest.raises(ValidationError, match='cargo y la oficina'):
        _ejecutar(t, cargo_definido=cargo, oficina_definida=oficina)


@pytest.mark.parametrize('t', [t for t in TRANSICIONES if Guarda.VENTANA_VIGENTE in t.guardas], ids=_id)
def test_ventana_vencida_bloquea_al_postulante(t):
    with pytest.raises(ConflictError, match='ventana'):
        _ejecutar(t, ventana_vence_el=AHORA - timedelta(seconds=1))
    with pytest.raises(ConflictError, match='ventana'):
        _ejecutar(t, ventana_vence_el=None)


def test_ventana_justo_en_el_limite_aun_vale():
    t = buscar_transicion(E.EN_CAPTURA, E.ENVIADO_CAPTACION)
    assert _ejecutar(t, ventana_vence_el=AHORA) is t


@pytest.mark.parametrize('origen', [E.PRE_REGISTRADO, E.EN_CAPTURA])
def test_expirar_solo_si_la_ventana_vencio(origen):
    t = buscar_transicion(origen, E.EXPIRADO)
    assert _ejecutar(t) is t
    with pytest.raises(ConflictError, match='todavía está vigente'):
        _ejecutar(t, ventana_vence_el=AHORA + timedelta(days=1))


def test_punto_de_cuenta_exige_reserva_y_disponibilidad():
    t = buscar_transicion(E.EN_PRESUPUESTO, E.EN_DIRECCION_GENERAL)
    for cambios in ({'puesto_reservado': False}, {'disponibilidad_declarada': False}):
        with pytest.raises(ConflictError, match='Punto de Cuenta'):
            _ejecutar(t, **cambios)


def test_asignar_cargo_exige_reserva_vigente_y_puesto_revalidado():
    t = buscar_transicion(E.LISTO_PARA_ASIGNAR, E.CONTRATADO)
    for cambios in (
        {'reserva_vence_el': AHORA - timedelta(days=1)}, {'reserva_vence_el': None}, {'puesto_revalidado': False},
    ):
        with pytest.raises(ConflictError, match='reserva'):
            _ejecutar(t, **cambios)


def test_volver_a_presupuesto_solo_si_el_puesto_se_perdio():
    t = buscar_transicion(E.LISTO_PARA_ASIGNAR, E.EN_PRESUPUESTO)
    assert _ejecutar(t) is t  # el helper ya vence la reserva
    with pytest.raises(ConflictError, match='sigue vigente'):
        _ejecutar(t, reserva_vence_el=AHORA + timedelta(days=5))
    assert _ejecutar(t, reserva_vence_el=AHORA + timedelta(days=5), puesto_revalidado=False) is t


def test_las_autotransiciones_no_dejan_historial():
    sin = [t for t in TRANSICIONES if not t.registra_historial]
    assert {_id(t) for t in sin} == {'EN_CAPTURA->EN_CAPTURA', 'CONSOLIDANDO->CONSOLIDANDO'}
    assert all(t.es_autotransicion for t in sin)


# --- efectos sobre el expediente ---

def _exp(estado, **kw):
    return ExpedientePostulacion(id='1', numero='EXP-2026-00001', postulante_id='1', estado=estado, **kw)


def test_efecto_aprobado_a_consolidando_abre_ventana_2_con_los_dias_del_parametro():
    t = buscar_transicion(E.APROBADO, E.CONSOLIDANDO)
    nuevo = aplicar_transicion(_exp(E.APROBADO, ventana=1), t, AHORA, VIG)
    assert nuevo.estado == E.CONSOLIDANDO and nuevo.ventana == 2
    assert nuevo.ventana_vence_el == AHORA + timedelta(days=10)


def test_efecto_observar_reabre_ventana_1():
    t = buscar_transicion(E.ENVIADO_CAPTACION, E.EN_CORRECCION_DATOS)
    assert aplicar_transicion(_exp(E.ENVIADO_CAPTACION), t, AHORA, VIG).ventana_vence_el == AHORA + timedelta(days=15)


def test_efecto_punto_de_cuenta_fija_vencimiento_de_la_reserva_y_rechazo_la_libera():
    t = buscar_transicion(E.EN_PRESUPUESTO, E.EN_DIRECCION_GENERAL)
    con_reserva = aplicar_transicion(_exp(E.EN_PRESUPUESTO), t, AHORA, VIG)
    assert con_reserva.reserva_vence_el == AHORA + timedelta(days=30)
    t2 = buscar_transicion(E.EN_DIRECCION_GENERAL, E.RECHAZADO_DIRECCION)
    cerrado = aplicar_transicion(con_reserva, t2, AHORA, VIG)
    assert cerrado.reserva_vence_el is None and cerrado.fecha_cierre == AHORA and cerrado.es_terminal


def test_autotransicion_consolidando_no_extiende_la_ventana():
    t = buscar_transicion(E.CONSOLIDANDO, E.CONSOLIDANDO)
    venc = AHORA + timedelta(days=2)
    assert aplicar_transicion(_exp(E.CONSOLIDANDO, ventana=2, ventana_vence_el=venc), t, AHORA, VIG).ventana_vence_el == venc


# --- espera del diferido (C-10) ---

def test_desistir_un_diferido_antes_del_plazo_se_rechaza_en_espanol():
    t = buscar_transicion(E.DIFERIDO_PRESUPUESTO, E.DESISTIDO)
    for vence in (AHORA + timedelta(days=1), AHORA, None):
        with pytest.raises(ConflictError, match='plazo de espera'):
            _ejecutar(t, diferido_vence_el=vence)


def test_desistir_un_diferido_vencido_el_plazo_se_permite_solo_al_sistema():
    t = buscar_transicion(E.DIFERIDO_PRESUPUESTO, E.DESISTIDO)
    assert _ejecutar(t, diferido_vence_el=AHORA - timedelta(seconds=1)) is t
    with pytest.raises(PermissionDeniedError):
        _ejecutar(t, actor=Actor(cedula='1', permisos=frozenset({'postulacion.declarar_disponibilidad'})))


def test_efecto_diferir_fija_el_vencimiento_y_volver_a_presupuesto_lo_limpia():
    t = buscar_transicion(E.EN_PRESUPUESTO, E.DIFERIDO_PRESUPUESTO)
    diferido = aplicar_transicion(_exp(E.EN_PRESUPUESTO), t, AHORA, VIG)
    assert diferido.diferido_vence_el == AHORA + timedelta(days=90)
    t2 = buscar_transicion(E.DIFERIDO_PRESUPUESTO, E.EN_PRESUPUESTO)
    assert aplicar_transicion(diferido, t2, AHORA, VIG).diferido_vence_el is None
    t3 = buscar_transicion(E.DIFERIDO_PRESUPUESTO, E.DESISTIDO)
    assert aplicar_transicion(diferido, t3, AHORA, VIG).diferido_vence_el is None
