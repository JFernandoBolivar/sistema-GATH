"""Plantillas por capas, fondos fijos y biblioteca: paginación y búsqueda en el servidor; borrado protegido."""
import pytest
from rest_framework.test import APIClient

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    ElementoBibliotecaModel,
    PlantillaCarnetModel,
)

pytestmark = pytest.mark.django_db

BASE = "/api/v1/carnetizacion"
CLAVES = {"resultados", "total", "pagina", "tamano", "total_paginas"}


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self):
        self.pk = 1
        self.id = None
        self.cedula_id = "V-1"
        self.rol_id = None

    def tiene_permiso(self, codigo):
        return True


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


def _datos(respuesta):
    assert respuesta.status_code == 200, respuesta.content
    return respuesta.json()["data"]


def test_biblioteca_paginada_busqueda_y_categoria(api):
    for n in range(1, 15):
        ElementoBibliotecaModel.objects.create(
            nombre=f"Logo {n:02d}" if n <= 13 else "Firma Director",
            categoria="logo" if n <= 13 else "firma",
            archivo_clave=f"k{n}", tamano_bytes=10, mime_type="image/png",
        )
    d = _datos(api.get(f"{BASE}/biblioteca/?pagina=1&page_size=12"))
    assert set(d) == CLAVES
    assert (d["total"], d["tamano"], d["total_paginas"], len(d["resultados"])) == (14, 12, 2, 12)
    assert len(_datos(api.get(f"{BASE}/biblioteca/?pagina=2&page_size=12"))["resultados"]) == 2
    assert _datos(api.get(f"{BASE}/biblioteca/?pagina=1&categoria=firma"))["total"] == 1
    assert _datos(api.get(f"{BASE}/biblioteca/?pagina=1&busqueda=director"))["total"] == 1
    assert _datos(api.get(f"{BASE}/biblioteca/?pagina=1&categoria=logo&busqueda=Logo 1"))["total"] == 4  # Logo 10..13
    # Sin `pagina` sigue devolviendo la lista completa (selector del diseñador).
    assert len(_datos(api.get(f"{BASE}/biblioteca/"))) == 14


def test_biblioteca_rechaza_pagina_invalida(api):
    assert api.get(f"{BASE}/biblioteca/?pagina=0").status_code == 400


def test_plantillas_motor_paginadas_y_busqueda(api):
    api.get(f"{BASE}/plantillas-motor/")  # siembra las plantillas por defecto
    base = PlantillaCarnetModel.objects.first()
    for n in range(14):
        PlantillaCarnetModel.objects.create(
            nombre=f"Diseño extra {n:02d}", tipo_credencial=base.tipo_credencial,
            estado="borrador", activa=False, definicion={},
        )
    total = PlantillaCarnetModel.objects.count()
    d = _datos(api.get(f"{BASE}/plantillas-motor/?pagina=1&page_size=12"))
    assert set(d) == CLAVES
    assert (d["total"], len(d["resultados"])) == (total, 12)
    assert _datos(api.get(f"{BASE}/plantillas-motor/?pagina=1&busqueda=Diseño extra 03"))["total"] == 1
    assert len(_datos(api.get(f"{BASE}/plantillas-motor/"))) == total


def test_los_fondos_fijos_legacy_ya_no_existen(api):
    """B-7: el fondo fijo clásico se retiró; la maqueta vive en el motor como LEGACY."""
    assert api.get(f"{BASE}/fondos-fijos/").status_code == 404
    assert api.delete(f"{BASE}/fondos-fijos/999999/").status_code == 404
