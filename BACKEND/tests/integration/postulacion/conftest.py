"""Fixtures compartidas de las pruebas de Presupuesto, Dirección General y vencimientos (bloque E)."""
import pytest

from tests.integration.postulacion._presupuesto_mundo import crear_mundo


@pytest.fixture
def mundo(db):
    """Catálogos, estructura organizativa y puestos (ver `crear_mundo`)."""
    return crear_mundo()
