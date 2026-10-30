"""Decisión H (alcance por tipo de pensión, devolución) y C8 (recordatorios) sin Django ni BD."""
from dataclasses import replace
from datetime import timedelta

import pytest

from apps.fe_de_vida.application.use_cases import consultas, procesos, revision
from apps.fe_de_vida.application.use_cases import solicitudes_pasivo as sp
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida
from apps.fe_de_vida.domain.services.notificaciones_eventos import solicitudes_de_evento
from apps.fe_de_vida.domain.value_objects.estados import EstadoProceso, EstadoSolicitud as E
from core.domain.exceptions import ConflictError, PermissionDeniedError, ValidationError
from tests.unit.fe_de_vida.memoria import (
    AHORA, ANALISTA, APERTURA, CIERRE, OTRO_PASIVO, PASIVO, AlcanceMem, Mundo, PublicadorMem, RepoProcesosMem,
    RepoSolicitudesMem,
)


@pytest.fixture
def m():
    return Mundo()


def proceso(**kw):
    return ProcesoFeDeVida('p', 'Fe de vida', APERTURA, CIERRE, **kw)


# ── Entidad ──
def test_alcance_y_recordatorios_se_normalizan_y_validan():
    p = proceso(tipos_nomina=(3, 1), dias_recordatorio=(1, 7, 3))
    assert p.tipos_nomina == (1, 3) and p.dias_recordatorio == (7, 3, 1)
    for malo in ({'tipos_nomina': (1, 1)}, {'tipos_nomina': (0,)}, {'dias_recordatorio': (0,)},
                 {'dias_recordatorio': (3, 3)}, {'dias_recordatorio': (366,)}, {'dias_recordatorio': tuple(range(1, 12))}):
        with pytest.raises(ValidationError):
            proceso(**malo)


def test_aplica_a_sin_tipos_es_todos_y_con_tipos_solo_esos():
    assert proceso().aplica_a(None) and proceso().aplica_a(5)
    acotado = proceso(tipos_nomina=(1,))
    assert acotado.aplica_a(1) and not acotado.aplica_a(2) and not acotado.aplica_a(None)


def test_editar_por_estado():
    borrador = proceso()
    assert borrador.editar(nombre='x', tipos_nomina=(1,)).tipos_nomina == (1,)
    abierto = replace(borrador, estado=EstadoProceso.ABIERTO)
    assert abierto.editar(dias_recordatorio=(2,)).dias_recordatorio == (2,)
    with pytest.raises(ConflictError):
        abierto.editar(tipos_nomina=(1,))
    with pytest.raises(ConflictError):
        replace(borrador, estado=EstadoProceso.CERRADO).editar(dias_recordatorio=(2,))


# ── Casos de uso: alcance ──
def test_crear_proceso_valida_el_alcance_contra_el_catalogo(m):
    ok = procesos.crear_proceso(m.procesos, m.alcance, nombre='x', fecha_apertura=APERTURA, fecha_cierre=CIERRE,
                                actor='1', tipos_nomina=(2,))
    assert ok.tipos_nomina == (2,)
    with pytest.raises(ValidationError):
        procesos.crear_proceso(m.procesos, m.alcance, nombre='x', fecha_apertura=APERTURA, fecha_cierre=CIERRE,
                               actor='1', tipos_nomina=(99,))
    with pytest.raises(ValidationError):  # sin catálogo no se acepta un alcance (falla cerrado)
        procesos.crear_proceso(m.procesos, None, nombre='x', fecha_apertura=APERTURA, fecha_cierre=CIERRE,
                               actor='1', tipos_nomina=(1,))


def test_editar_proceso_caso_de_uso(m):
    p = procesos.crear_proceso(m.procesos, m.alcance, nombre='x', fecha_apertura=APERTURA, fecha_cierre=CIERRE, actor='1')
    assert procesos.editar_proceso(m.procesos, m.alcance, proceso_id=p.id, cambios={'tipos_nomina': [1]}).tipos_nomina == (1,)
    with pytest.raises(ValidationError):
        procesos.editar_proceso(m.procesos, m.alcance, proceso_id=p.id, cambios={})
    with pytest.raises(ValidationError):
        procesos.editar_proceso(m.procesos, m.alcance, proceso_id=p.id, cambios={'tipos_nomina': [77]})
    with pytest.raises(ValidationError):
        procesos.editar_proceso(m.procesos, m.alcance, proceso_id=p.id, cambios={'creado_por': 'otro'})


def acotado(m, tipos):
    p = procesos.crear_proceso(m.procesos, m.alcance, nombre='acotado', fecha_apertura=APERTURA, fecha_cierre=CIERRE,
                               actor='1', tipos_nomina=tipos)
    return procesos.abrir_proceso(m.procesos, m.publicador, proceso_id=p.id, actor='1')


def test_solo_los_pasivos_del_alcance_ven_el_proceso_vigente_e_inician(m):
    m.procesos.filas.pop(m.proceso.id)  # solo el proceso acotado
    p = acotado(m, (1,))
    assert consultas.obtener_proceso_vigente(m.procesos, m.solicitudes, m.alcance, cedula=PASIVO, ahora=AHORA).proceso.id == p.id
    assert consultas.obtener_proceso_vigente(m.procesos, m.solicitudes, m.alcance, cedula=OTRO_PASIVO, ahora=AHORA) is None
    with pytest.raises(PermissionDeniedError):
        sp.iniciar_solicitud(m.procesos, m.solicitudes, m.verificador, m.alcance, proceso_id=p.id, cedula=OTRO_PASIVO, ahora=AHORA)
    with pytest.raises(ConflictError):
        sp.iniciar_solicitud_vigente(m.procesos, m.solicitudes, m.verificador, m.alcance, cedula=OTRO_PASIVO, ahora=AHORA)
    assert sp.iniciar_solicitud(m.procesos, m.solicitudes, m.verificador, m.alcance, proceso_id=p.id, cedula=PASIVO, ahora=AHORA)


def test_prorroga_no_amplia_el_alcance(m):
    m.procesos.filas.pop(m.proceso.id)
    p = acotado(m, (1,))
    procesos.prorrogar_proceso(m.procesos, m.solicitudes, m.publicador, proceso_id=p.id, cedula=OTRO_PASIVO,
                               nueva_fecha_limite=AHORA + timedelta(days=5), motivo='x', actor='1', ahora=AHORA)
    assert consultas.obtener_proceso_vigente(m.procesos, m.solicitudes, m.alcance, cedula=OTRO_PASIVO, ahora=AHORA) is None


# ── Devolver ──
def test_devolver_motivo_obligatorio_y_evento_con_bandera(m):
    s = m.solicitud_enviada()
    with pytest.raises(ValidationError):
        revision.devolver(m.solicitudes, m.publicador, solicitud_id=s.id, actor=ANALISTA, motivo=' ', ahora=AHORA)
    d = revision.devolver(m.solicitudes, m.publicador, solicitud_id=s.id, actor=ANALISTA, motivo='teléfono', ahora=AHORA)
    assert d.estado is E.DEVUELTA and d.evidencia_clave and d.requiere_nueva_foto is False
    ev = [e for e in m.publicador.eventos if e.tipo.value == 'fe_de_vida.devuelta'][0]
    assert ev.detalle['requiere_nueva_foto'] is False
    # sin foto nueva puede reenviar tal cual; el aviso explica la corrección
    assert sp.enviar_solicitud(m.procesos, m.solicitudes, solicitud_id=s.id, cedula=PASIVO, ahora=AHORA).estado is E.PENDIENTE_REVISION
    aviso = solicitudes_de_evento(ev)[0]
    assert 'devuelta para corrección' in aviso.titulo and 'foto nueva' not in aviso.mensaje


def test_devolver_con_nueva_foto_retira_la_vigente_y_el_aviso_la_pide(m):
    s = m.solicitud_enviada()
    d = revision.devolver(m.solicitudes, m.publicador, solicitud_id=s.id, actor=ANALISTA, motivo='borrosa',
                          requiere_nueva_foto=True, ahora=AHORA)
    assert d.evidencia_clave == '' and d.requiere_nueva_foto and len(d.evidencias_previas) == 1
    with pytest.raises(ValidationError):
        sp.enviar_solicitud(m.procesos, m.solicitudes, solicitud_id=s.id, cedula=PASIVO, ahora=AHORA)
    ev = [e for e in m.publicador.eventos if e.tipo.value == 'fe_de_vida.devuelta'][0]
    assert 'foto nueva' in solicitudes_de_evento(ev)[0].mensaje


# ── C8 recordatorios ──
def abierto_con(m, dias_para_cierre, dias=(7, 3, 1), tipos=()):
    m.procesos.filas.pop(m.proceso.id, None)
    for otro in list(m.procesos.filas):
        m.procesos.filas.pop(otro)
    p = procesos.crear_proceso(m.procesos, m.alcance, nombre='r', fecha_apertura=APERTURA,
                               fecha_cierre=AHORA + timedelta(days=dias_para_cierre), actor='1',
                               tipos_nomina=tipos, dias_recordatorio=dias)
    return procesos.abrir_proceso(m.procesos, m.publicador, proceso_id=p.id, actor='1')


def recordar(m):
    pub = PublicadorMem()
    n = procesos.enviar_recordatorios(m.procesos, m.solicitudes, m.alcance, pub, ahora=AHORA)
    return n, pub


def test_recordatorio_en_umbral_a_todos_los_del_alcance_sin_enviar(m):
    abierto_con(m, 3)
    n, pub = recordar(m)
    assert n == 2 and {e.cedula for e in pub.eventos} == {PASIVO, OTRO_PASIVO}
    avisos = [solicitudes_de_evento(e)[0] for e in pub.eventos]
    assert all(a.clave == '3' and a.ref_id == pub.eventos[0].proceso_id and a.correo for a in avisos)
    assert 'en 3 días' in avisos[0].mensaje


def test_recordatorio_es_idempotente_por_clave_de_proceso_y_umbral(m):
    abierto_con(m, 3)
    a = [solicitudes_de_evento(e)[0] for e in recordar(m)[1].eventos]
    b = [solicitudes_de_evento(e)[0] for e in recordar(m)[1].eventos]
    assert [(x.tipo, x.ref_id, x.clave, x.cedula_destino) for x in a] == [(x.tipo, x.ref_id, x.clave, x.cedula_destino) for x in b]


def test_recordatorio_fuera_de_umbral_o_sin_dias_no_avisa(m):
    abierto_con(m, 5)
    assert recordar(m)[0] == 0
    abierto_con(m, 3, dias=())
    assert recordar(m)[0] == 0


def test_recordatorio_mañana_y_excluye_a_quien_ya_envio(m):
    abierto_con(m, 1)
    s = sp.iniciar_solicitud(m.procesos, m.solicitudes, m.verificador, m.alcance,
                             proceso_id=m.procesos.listar('ABIERTO')[0].id, cedula=PASIVO, ahora=AHORA)
    sp.subir_evidencia(m.procesos, m.solicitudes, m.storage, solicitud_id=s.id, cedula=PASIVO,
                       contenido=b'\xff\xd8\xffx', mime='image/jpeg', origen='CAMARA', metadatos=None, ahora=AHORA)
    sp.enviar_solicitud(m.procesos, m.solicitudes, solicitud_id=s.id, cedula=PASIVO, ahora=AHORA)
    n, pub = recordar(m)
    assert n == 1 and pub.eventos[0].cedula == OTRO_PASIVO and 'mañana' in solicitudes_de_evento(pub.eventos[0])[0].mensaje


def test_recordatorio_respeta_alcance_y_borrador_devuelta_si_reciben(m):
    abierto_con(m, 3, tipos=(2,))
    n, pub = recordar(m)
    assert n == 1 and pub.eventos[0].cedula == OTRO_PASIVO
    s = sp.iniciar_solicitud(m.procesos, m.solicitudes, m.verificador, m.alcance,
                             proceso_id=m.procesos.listar('ABIERTO')[0].id, cedula=OTRO_PASIVO, ahora=AHORA)
    assert s.estado is E.BORRADOR and recordar(m)[0] == 1  # un borrador sigue sin haber enviado
