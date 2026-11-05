"""O12: política de solicitudes de actualización por condición del trabajador."""
import pytest

from apps.autogestion.application.dtos.actualizacion_dtos import ItemCambioDTO
from apps.autogestion.application.use_cases.edicion_trabajador import guardar_borrador
from apps.autogestion.application.use_cases.solicitud_ciclo import (
    habilitar_ventana,
    solicitar_actualizacion,
)
from apps.autogestion.domain.services.politica_condicion import (
    PoliticaAutogestion,
    normalizar_secciones,
)
from core.domain.exceptions import ValidationError

from .memoria_actualizacion import AHORA, Mundo, TRABAJADOR


def politica(habilitado=True, secciones=("contacto",), condicion="ACTIVO"):
    return PoliticaAutogestion(
        condicion=condicion, habilitado=habilitado, secciones=frozenset(secciones),
    )


def test_solicitud_bloqueada_si_la_condicion_esta_apagada():
    m = Mundo()
    with pytest.raises(ValidationError, match="no están habilitadas"):
        solicitar_actualizacion(
            m.solicitudes, m.secciones, m.publicador,
            cedula=TRABAJADOR, secciones=["contacto"], motivo="Cambié de número de teléfono móvil",
            politica=politica(habilitado=False),
        )


def test_solicitud_rechaza_una_seccion_no_habilitada_para_la_condicion():
    m = Mundo()
    with pytest.raises(ValidationError, match="no están habilitadas") as error:
        solicitar_actualizacion(
            m.solicitudes, m.secciones, m.publicador,
            cedula=TRABAJADOR, secciones=["vivienda"], motivo="Cambié de dirección de residencia",
            politica=politica(secciones=("contacto",)),
        )
    assert error.value.campo == "campos"


def test_solicitud_permite_una_seccion_habilitada():
    m = Mundo()
    solicitud = solicitar_actualizacion(
        m.solicitudes, m.secciones, m.publicador,
        cedula=TRABAJADOR, secciones=["contacto"], motivo="Cambié de número de teléfono móvil",
        politica=politica(),
    )
    assert solicitud.secciones_solicitadas == ("contacto",)


def test_borrador_no_permite_una_seccion_fuera_de_la_politica():
    m = Mundo()
    solicitud = solicitar_actualizacion(
        m.solicitudes, m.secciones, m.publicador,
        cedula=TRABAJADOR, secciones=["contacto"], motivo="Cambié de número de teléfono móvil",
        politica=politica(),
    )
    habilitar_ventana(
        m.solicitudes, m.publicador, solicitud_id=solicitud.id, plazo_dias=5,
        actor="20222222", ahora=AHORA,
    )
    # La solicitud ya existe: el borrador solo revalida las secciones permitidas.
    with pytest.raises(ValidationError, match="no están habilitadas"):
        guardar_borrador(
            m.solicitudes, m.cambios, m.ficha, solicitud_id=solicitud.id, cedula=TRABAJADOR,
            items=[ItemCambioDTO("vivienda", "datos_vivienda", "MODIFICAR", "direccion_exacta", "Nueva dirección")],
            version=None, ahora=AHORA, politica=politica(secciones=("contacto",)),
        )


def test_normalizar_secciones_filtra_y_ordena_segun_el_dominio():
    assert normalizar_secciones("vivienda, contacto") == frozenset({"contacto", "vivienda"})
    assert normalizar_secciones("no-existe") == frozenset(normalizar_secciones(None))
    assert "contacto" in normalizar_secciones(None)
