"""
Pruebas unitarias de dominio y casos de uso para la Fe de Vida Presencial (A9).
"""
import pytest
from dataclasses import replace

from apps.fe_de_vida.application.use_cases import revision
from apps.fe_de_vida.domain.entities.solicitud import (
    Canal,
    DecisionFeDeVida,
    PermisosRevision,
    SolicitudFeDeVida,
)
from apps.fe_de_vida.domain.value_objects.estados import (
    EstadoSolicitud,
    OrigenEvidencia,
    TipoDecision,
)
from core.domain.exceptions import ConflictError
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
            registrador_puede_checar=False,
        )


def test_registrador_puede_decidir_si_parametro_esta_encendido():
    sol = _solicitud_presencial_enviada(registrador_cedula=ADMINISTRADORA.cedula)
    permisos = PermisosRevision(revisar=True, check=True, aprobar_directo=True)

    acciones = sol.acciones_disponibles(
        ADMINISTRADORA, permisos, registrador_puede_checar=True,
    )
    assert {'dar_check', 'aprobar_directo', 'devolver', 'rechazar'} <= set(acciones)

    m = Mundo()
    s = m.solicitud_enviada()
    s_pres = replace(
        s,
        canal=Canal.PRESENCIAL.value,
        registrada_por='ADMINISTRADORA REGISTRADORA',
        registrada_por_cedula=ADMINISTRADORA.cedula,
    )
    m.solicitudes.filas[s_pres.id] = s_pres

    res = revision.dar_check(
        m.solicitudes, m.aplicador, m.publicador,
        solicitud_id=s_pres.id, actor=ADMINISTRADORA, ahora=AHORA,
        registrador_puede_checar=True,
    )
    assert res.estado == EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK


def test_administradora_registradora_no_decide_si_parametro_esta_apagado():
    sol = _solicitud_presencial_enviada(registrador_cedula=ADMINISTRADORA.cedula)
    permisos = PermisosRevision(revisar=True, check=True, aprobar_directo=True)

    acciones = sol.acciones_disponibles(
        ADMINISTRADORA, permisos, registrador_puede_checar=False,
    )
    assert acciones == ()
