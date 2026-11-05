"""
Pruebas unitarias de dominio y casos de uso para la Fe de Vida Presencial (A9).
"""
import pytest
from dataclasses import replace

from apps.fe_de_vida.application.use_cases import revision
from apps.fe_de_vida.domain.entities.solicitud import (
    Canal,
    PermisosRevision,
    SolicitudFeDeVida,
)
from apps.fe_de_vida.domain.value_objects.estados import (
    EstadoSolicitud,
    OrigenEvidencia,
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


def test_registrador_no_puede_dar_check_si_parametro_esta_apagado():
    sol = _solicitud_presencial_enviada(registrador_cedula=ANALISTA.cedula)
    permisos = PermisosRevision(revisar=True, check=True)

    # El registrador (ANALISTA) no tiene 'dar_check' disponible
    acciones_registrador = sol.acciones_disponibles(
        ANALISTA, permisos, registrador_puede_checar=False,
    )
    assert 'dar_check' not in acciones_registrador
    assert 'devolver' in acciones_registrador
    assert 'rechazar' in acciones_registrador

    # Otro analista sí puede dar check
    acciones_otro = sol.acciones_disponibles(
        OTRA_ANALISTA, permisos, registrador_puede_checar=False,
    )
    assert 'dar_check' in acciones_otro


def test_registrador_intenta_dar_check_con_parametro_apagado_lanza_conflict():
    m = Mundo()
    s = m.solicitud_enviada()
    s_pres = replace(
        s,
        canal=Canal.PRESENCIAL.value,
        registrada_por='ANALISTA REGISTRADOR',
        registrada_por_cedula=ANALISTA.cedula,
    )
    m.solicitudes.filas[s_pres.id] = s_pres

    with pytest.raises(ConflictError, match="Quien registró la fe de vida presencial no puede dar el check"):
        revision.dar_check(
            m.solicitudes, m.aplicador, m.publicador,
            solicitud_id=s_pres.id, actor=ANALISTA, ahora=AHORA,
            registrador_puede_checar=False,
        )


def test_registrador_puede_dar_check_si_parametro_esta_encendido():
    sol = _solicitud_presencial_enviada(registrador_cedula=ANALISTA.cedula)
    permisos = PermisosRevision(revisar=True, check=True)

    acciones = sol.acciones_disponibles(
        ANALISTA, permisos, registrador_puede_checar=True,
    )
    assert 'dar_check' in acciones

    m = Mundo()
    s = m.solicitud_enviada()
    s_pres = replace(
        s,
        canal=Canal.PRESENCIAL.value,
        registrada_por='ANALISTA REGISTRADOR',
        registrada_por_cedula=ANALISTA.cedula,
    )
    m.solicitudes.filas[s_pres.id] = s_pres

    res = revision.dar_check(
        m.solicitudes, m.aplicador, m.publicador,
        solicitud_id=s_pres.id, actor=ANALISTA, ahora=AHORA,
        registrador_puede_checar=True,
    )
    assert res.estado == EstadoSolicitud.PENDIENTE_SEGUNDO_CHECK


def test_administradora_registradora_conserva_aprobacion_directa():
    sol = _solicitud_presencial_enviada(registrador_cedula=ADMINISTRADORA.cedula)
    permisos = PermisosRevision(revisar=True, check=True, aprobar_directo=True)

    acciones = sol.acciones_disponibles(
        ADMINISTRADORA, permisos, registrador_puede_checar=False,
    )
    # dar_check no está, pero aprobar_directo sí
    assert 'dar_check' not in acciones
    assert 'aprobar_directo' in acciones
