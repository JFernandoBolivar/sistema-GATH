"""Fixtures compartidas de las pruebas de Presupuesto, Dirección General y vencimientos (bloque E)."""
import pytest

from tests.integration.postulacion._presupuesto_mundo import crear_mundo
from tests.integration.puntocuenta._plantillas import sembrar_plantillas_punto_cuenta


@pytest.fixture
def mundo(db):
    """Catálogos, estructura organizativa y puestos (ver `crear_mundo`) y las plantillas del Punto de Cuenta (N-2)."""
    sembrar_plantillas_punto_cuenta()
    return crear_mundo()
