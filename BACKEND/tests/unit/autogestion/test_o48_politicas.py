"""O48: bloqueo por solicitud pendiente y espera tras aprobación."""
from datetime import date, timedelta

import pytest

from apps.autogestion.application.use_cases.solicitud_ciclo import solicitar_actualizacion
from apps.autogestion.domain.entities.solicitud_actualizacion import SolicitudActualizacion
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from core.domain.exceptions import ConflictError

from .memoria_actualizacion import Mundo
from .test_actualizacion_flujo import AHORA, TRABAJADOR, habilitar, solicitar


def _solicitar(m, campos, **opciones):
    return solicitar_actualizacion(
        m.solicitudes,
        m.secciones,
        m.publicador,
        cedula=TRABAJADOR,
        motivo="Necesito corregir mis datos personales.",
        campos=campos,
        **opciones,
    )


def test_bloqueo_por_seccion_impide_repetir_la_misma_seccion():
    m = Mundo()
    habilitar(m, solicitar(m, ("contacto",)))

    with pytest.raises(ConflictError, match="solicitud pendiente"):
        _solicitar(m, ["employee.telefono_movil"], bloqueo="seccion")


def test_registro_permite_otro_campo_de_la_misma_seccion():
    m = Mundo()
    primera = _solicitar(m, ["employee.telefono_movil"], bloqueo="registro")

    segunda = _solicitar(m, ["employee.telefono_habitacion"], bloqueo="registro")

    assert primera.id != segunda.id


def test_registro_impide_el_mismo_campo_pendiente():
    m = Mundo()
    _solicitar(m, ["employee.telefono_movil"], bloqueo="registro")

    with pytest.raises(ConflictError, match="solicitud pendiente"):
        _solicitar(m, ["employee.telefono_movil"], bloqueo="registro")


def test_desactivado_no_bloquea_la_misma_seccion():
    m = Mundo()
    _solicitar(m, ["employee.telefono_movil"], bloqueo="desactivado")

    segunda = _solicitar(m, ["employee.telefono_movil"], bloqueo="desactivado")

    assert segunda.id


def test_espera_tras_aprobacion_bloquea_corregir():
    m = Mundo()
    aprobada = SolicitudActualizacion(
        id="",
        cedula=TRABAJADOR,
        estado=EstadoSolicitud.APROBADA,
        secciones_solicitadas=("contacto",),
        motivo="Aprobada",
        campos_solicitados=("employee.telefono_movil",),
        fecha_decision=AHORA,
    )
    m.solicitudes.crear(aprobada, reservar=False)
    hasta = date.today() + timedelta(days=5)

    with pytest.raises(ConflictError, match="Podrás volver a solicitar"):
        _solicitar(
            m,
            ["employee.telefono_movil"],
            esperas_hasta={"contacto": hasta},
            espera_acciones=frozenset({"corregir", "quitar"}),
        )


def test_espera_no_aplica_a_una_accion_no_configurada():
    m = Mundo()
    aprobada = SolicitudActualizacion(
        id="",
        cedula=TRABAJADOR,
        estado=EstadoSolicitud.APROBADA,
        secciones_solicitadas=("familiar",),
        motivo="Aprobada",
        campos_solicitados=("familiar.@MODIFICAR",),
        fecha_decision=AHORA,
    )
    m.solicitudes.crear(aprobada, reservar=False)
    hasta = date.today() + timedelta(days=5)

    creada = _solicitar(
        m,
        ["familiar.@ELIMINAR"],
        esperas_hasta={"familiar": hasta},
        espera_acciones=frozenset({"corregir"}),
    )

    assert creada.id


def test_excepcion_con_motivo_permite_saltar_la_espera():
    m = Mundo()
    hasta = date.today() + timedelta(days=5)

    creada = _solicitar(
        m,
        ["employee.telefono_movil"],
        esperas_hasta={"contacto": hasta},
        espera_acciones=frozenset({"corregir"}),
        excepcion_motivo="Autorizada por RRHH para corregir un error de contacto.",
    )

    assert creada.id
