"""
Pruebas unitarias de dominio y casos de uso para la Fe de Vida Presencial (A9).
"""
import pytest
from dataclasses import replace

from apps.fe_de_vida.application.use_cases import revision
from apps.fe_de_vida.domain.entities.solicitud import (
    ActorRevision,
    Canal,
    DecisionFeDeVida,
    PermisosRevision,
    SolicitudFeDeVida,
)
from apps.fe_de_vida.domain.value_objects.estados import (
    EstadoSolicitud,
    OrigenEvidencia,
    RolRevision,
    TipoDecision,
    ViaAprobacion,
)
from core.domain.exceptions import ConflictError, ValidationError
from tests.unit.fe_de_vida.memoria import (
    ADMINISTRADORA,
    AHORA,
    ANALISTA,
    Mundo,
    OTRA_ANALISTA,
)


def _solicitud_presencial_enviada(registrador_cedula: str = '20000001') -> SolicitudFeDeVida:
    return SolicitudFeDeVida(
        id='sol-pres-1',
        proceso_id='proc-1',
        cedula='5111111',
        estado=EstadoSolicitud.PENDIENTE_REVISION,
        canal=Canal.PRESENCIAL.value,
        registrada_por='ANALISTA TEST',
        registrada_por_cedula=registrador_cedula,
        origen_evidencia=OrigenEvidencia.CAMARA,
        evidencia_clave='fotos/1.jpg',
    )


def test_solicitud_presencial_tiene_canal_y_registrador():
    sol = _solicitud_presencial_enviada(ANALISTA.cedula)
    assert sol.canal == Canal.PRESENCIAL.value
    assert sol.registrada_por == 'ANALISTA TEST'
    assert sol.registrada_por_cedula == ANALISTA.cedula


def test_registrador_no_puede_decidir_si_parametro_esta_apagado():
    sol = _solicitud_presencial_enviada(registrador_cedula=ANALISTA.cedula)
    permisos = PermisosRevision(revisar=True, check=True)

    # El registrador (ANALISTA) no tiene NINGUNA acción de decisión disponible.
    acciones_registrador = sol.acciones_disponibles(
        ANALISTA, permisos, registrador_puede_checar=False,
    )
    assert acciones_registrador == ()

    # Otro analista sí puede decidir.
    acciones_otro = sol.acciones_disponibles(
        OTRA_ANALISTA, permisos, registrador_puede_checar=False,
    )
    assert {'dar_check', 'devolver', 'rechazar'} <= set(acciones_otro)


def test_registrador_intenta_decidir_con_parametro_apagado_lanza_conflict():
    m = Mundo()
    s = m.solicitud_enviada()
    s_pres = replace(
        s,
        canal=Canal.PRESENCIAL.value,
        registrada_por='ANALISTA REGISTRADOR',
        registrada_por_cedula=ANALISTA.cedula,
    )
    m.solicitudes.filas[s_pres.id] = s_pres

    with pytest.raises(ConflictError, match="registró esta fe de vida"):
        revision.dar_check(
            m.solicitudes, m.aplicador, m.publicador,
            solicitud_id=s_pres.id, actor=ANALISTA, ahora=AHORA,
            registrador_puede_checar=False,
        )
    with pytest.raises(ConflictError, match="registró esta fe de vida"):
        revision.devolver(
            m.solicitudes, m.publicador,
            solicitud_id=s_pres.id, actor=ANALISTA, motivo='Corrija el teléfono', ahora=AHORA,
            registrador_puede_checar=False,
        )
    with pytest.raises(ConflictError, match="registró esta fe de vida"):
        revision.rechazar(
            m.solicitudes, m.publicador,
            solicitud_id=s_pres.id, actor=ANALISTA, motivo='Documentación ilegible', ahora=AHORA,
            registrador_puede_checar=False,
        )

    # Tampoco puede retirar un check que hubiera dado antes.
    con_check = replace(
        s_pres, estado=EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK, envios=1,
        decisiones=(DecisionFeDeVida(TipoDecision.CHECK, ANALISTA.rol, ANALISTA.cedula, 1, AHORA),),
    )
    m.solicitudes.filas[s_pres.id] = con_check
    with pytest.raises(ConflictError, match="registró esta fe de vida"):
        revision.retirar_check(
            m.solicitudes, m.publicador,
            solicitud_id=s_pres.id, actor=ANALISTA, motivo='Di el check por error', ahora=AHORA,
            registrador_puede_checar=False,
        )

    # La Administradora registradora tampoco alcanza la aprobación directa.
    m.solicitudes.filas[s_pres.id] = replace(s_pres, registrada_por_cedula=ADMINISTRADORA.cedula)
    with pytest.raises(ConflictError, match="registró esta fe de vida"):
        revision.aprobar_directo(
            m.solicitudes, m.aplicador, m.publicador,
            solicitud_id=s_pres.id, actor=ADMINISTRADORA, justificacion='Pasivo sin movilidad', ahora=AHORA,
            registrador_puede_aprobar_directo=False,
        )


def _presencial_registrada_por(registrador, m=None):
    m = m or Mundo()
    base = m.solicitud_enviada()
    sol = replace(
        base, canal=Canal.PRESENCIAL.value, registrada_por='REGISTRADOR', registrada_por_cedula=registrador.cedula,
    )
    m.solicitudes.filas[sol.id] = sol
    return m, sol


def test_registrador_analista_decide_si_parametro_esta_encendido():
    sol = _solicitud_presencial_enviada(registrador_cedula=ANALISTA.cedula)
    permisos = PermisosRevision(revisar=True, check=True)

    acciones = sol.acciones_disponibles(ANALISTA, permisos, registrador_puede_checar=True)
    assert {'dar_check', 'devolver', 'rechazar'} <= set(acciones)

    m, s_pres = _presencial_registrada_por(ANALISTA)
    res = revision.dar_check(
        m.solicitudes, m.aplicador, m.publicador,
        solicitud_id=s_pres.id, actor=ANALISTA, ahora=AHORA, registrador_puede_checar=True,
    )
    assert res.estado == EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK
    assert res.registrador_tambien_aprobo is True


def test_registrador_analista_ignora_el_interruptor_de_la_administradora():
    sol = _solicitud_presencial_enviada(registrador_cedula=ANALISTA.cedula)
    permisos = PermisosRevision(revisar=True, check=True)
    assert sol.acciones_disponibles(
        ANALISTA, permisos, registrador_puede_checar=False, registrador_puede_aprobar_directo=True,
    ) == ()


@pytest.mark.parametrize('puede_checar', [False, True])
def test_administradora_registradora_apagado_no_decide(puede_checar):
    sol = _solicitud_presencial_enviada(registrador_cedula=ADMINISTRADORA.cedula)
    permisos = PermisosRevision(revisar=True, check=True, aprobar_directo=True)
    assert sol.acciones_disponibles(
        ADMINISTRADORA, permisos, registrador_puede_checar=puede_checar, registrador_puede_aprobar_directo=False,
    ) == ()


@pytest.mark.parametrize('puede_checar', [False, True])
def test_administradora_registradora_encendido_habilita_flujo_completo(puede_checar):
    """Con su interruptor encendido revisa su propio registro y además puede aprobar de forma directa."""
    sol = _solicitud_presencial_enviada(registrador_cedula=ADMINISTRADORA.cedula)
    permisos = PermisosRevision(revisar=True, check=True, aprobar_directo=True)
    assert sol.acciones_disponibles(
        ADMINISTRADORA, permisos, registrador_puede_checar=puede_checar, registrador_puede_aprobar_directo=True,
    ) == ('dar_check', 'aprobar_directo', 'devolver', 'rechazar')
    sin_permiso = PermisosRevision(revisar=True, check=True, aprobar_directo=False)
    assert sol.acciones_disponibles(
        ADMINISTRADORA, sin_permiso, registrador_puede_checar=puede_checar, registrador_puede_aprobar_directo=True,
    ) == ('dar_check', 'devolver', 'rechazar')


@pytest.mark.parametrize('llamada', ['check', 'devolver', 'rechazar', 'retirar'])
def test_administradora_registradora_con_interruptor_revisa_su_registro(llamada):
    """Con el parámetro encendido puede dar check, devolver, rechazar y retirar su propio registro."""
    m, s_pres = _presencial_registrada_por(ADMINISTRADORA)
    if llamada == 'retirar':
        s_pres = replace(
            s_pres, estado=EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK,
            decisiones=(
                DecisionFeDeVida(
                    TipoDecision.CHECK, ADMINISTRADORA.rol, ADMINISTRADORA.cedula, s_pres.envios, AHORA,
                ),
            ),
        )
        m.solicitudes.filas[s_pres.id] = s_pres
    kwargs = dict(solicitud_id=s_pres.id, actor=ADMINISTRADORA, ahora=AHORA)

    if llamada == 'check':
        res = revision.dar_check(
            m.solicitudes, m.aplicador, m.publicador, **kwargs,
            admin_registradora_puede_decidir=True,
        )
        assert res.estado is EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK
        assert res.registrador_tambien_aprobo is True
    elif llamada == 'devolver':
        res = revision.devolver(
            m.solicitudes, m.publicador, **kwargs,
            motivo='Corrija el teléfono', admin_registradora_puede_decidir=True,
        )
        assert res.estado is EstadoSolicitud.DEVUELTA
    elif llamada == 'rechazar':
        res = revision.rechazar(
            m.solicitudes, m.publicador, **kwargs,
            motivo='Documentación ilegible', admin_registradora_puede_decidir=True,
        )
        assert res.estado is EstadoSolicitud.RECHAZADA
    else:
        res = revision.retirar_check(
            m.solicitudes, m.publicador, **kwargs,
            motivo='Di el check por error', admin_registradora_puede_decidir=True,
        )
        assert res.estado is EstadoSolicitud.PENDIENTE_REVISION


@pytest.mark.parametrize('puede_checar', [False, True])
def test_administradora_registradora_sin_interruptor_no_revisa(puede_checar):
    m, s_pres = _presencial_registrada_por(ADMINISTRADORA)
    llamadas = (
        lambda: revision.dar_check(
            m.solicitudes, m.aplicador, m.publicador, solicitud_id=s_pres.id, actor=ADMINISTRADORA, ahora=AHORA,
            registrador_puede_checar=puede_checar, admin_registradora_puede_decidir=False,
        ),
        lambda: revision.devolver(
            m.solicitudes, m.publicador, solicitud_id=s_pres.id, actor=ADMINISTRADORA, ahora=AHORA,
            motivo='Corrija el teléfono', registrador_puede_checar=puede_checar,
            admin_registradora_puede_decidir=False,
        ),
        lambda: revision.rechazar(
            m.solicitudes, m.publicador, solicitud_id=s_pres.id, actor=ADMINISTRADORA, ahora=AHORA,
            motivo='Documentación ilegible', registrador_puede_checar=puede_checar,
            admin_registradora_puede_decidir=False,
        ),
        lambda: revision.retirar_check(
            m.solicitudes, m.publicador, solicitud_id=s_pres.id, actor=ADMINISTRADORA, ahora=AHORA,
            motivo='Di el check por error', registrador_puede_checar=puede_checar,
            admin_registradora_puede_decidir=False,
        ),
    )
    for llamada in llamadas:
        with pytest.raises(ConflictError, match='registró esta fe de vida'):
            llamada()


def test_administradora_registradora_aprueba_directo_con_interruptor_y_queda_marcado():
    m, s_pres = _presencial_registrada_por(ADMINISTRADORA)
    res = revision.aprobar_directo(
        m.solicitudes, m.aplicador, m.publicador,
        solicitud_id=s_pres.id, actor=ADMINISTRADORA, justificacion='Pasivo sin movilidad', ahora=AHORA,
        registrador_puede_aprobar_directo=True,
    )
    assert res.estado == EstadoSolicitud.VALIDADA
    assert res.via_aprobacion == ViaAprobacion.DIRECTA_ADMINISTRADORA
    assert res.registrador_tambien_aprobo is True
    assert res.decisiones[-1].tipo is TipoDecision.APROBACION_DIRECTA
    assert res.decisiones[-1].motivo == 'Pasivo sin movilidad'
    finales = [e for e in m.publicador.eventos if e.tipo.value in ('fe_de_vida.aprobacion_directa', 'fe_de_vida.validada')]
    assert len(finales) == 2
    assert all(e.detalle.get('registrador_tambien_aprobo') is True for e in finales)


def test_administradora_registradora_aprobacion_directa_exige_justificacion():
    m, s_pres = _presencial_registrada_por(ADMINISTRADORA)
    with pytest.raises(ValidationError):
        revision.aprobar_directo(
            m.solicitudes, m.aplicador, m.publicador,
            solicitud_id=s_pres.id, actor=ADMINISTRADORA, justificacion='   ', ahora=AHORA,
            registrador_puede_aprobar_directo=True,
        )


def test_aprobacion_directa_de_otra_administradora_no_marca_registrador():
    m, s_pres = _presencial_registrada_por(ANALISTA)
    res = revision.aprobar_directo(
        m.solicitudes, m.aplicador, m.publicador,
        solicitud_id=s_pres.id, actor=ADMINISTRADORA, justificacion='Pasivo sin movilidad', ahora=AHORA,
    )
    assert res.estado == EstadoSolicitud.VALIDADA
    assert res.registrador_tambien_aprobo is False


def test_el_pasivo_nunca_aprueba_su_propia_fe_de_vida_aunque_los_interruptores_esten_encendidos():
    sol = _solicitud_presencial_enviada(registrador_cedula=ADMINISTRADORA.cedula)
    propio = ActorRevision('5111111', RolRevision.ADMINISTRADORA)
    permisos = PermisosRevision(revisar=True, check=True, aprobar_directo=True)
    assert sol.acciones_disponibles(
        propio, permisos, registrador_puede_checar=True, registrador_puede_aprobar_directo=True,
    ) == ()
    with pytest.raises(ConflictError, match='propia fe de vida'):
        sol.aprobar_directo(propio, 'Justificación', AHORA, registrador_puede_aprobar_directo=True)


def test_proceso_cerrado_no_cambia_con_los_interruptores():
    sol = _solicitud_presencial_enviada(registrador_cedula=ADMINISTRADORA.cedula)
    permisos = PermisosRevision(revisar=True, check=True, aprobar_directo=True)
    assert sol.acciones_disponibles(
        ADMINISTRADORA, permisos, registrador_puede_checar=True, registrador_puede_aprobar_directo=True,
        proceso_cerrado=True,
    ) == ()
