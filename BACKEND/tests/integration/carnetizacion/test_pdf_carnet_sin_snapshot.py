"""D1/FIX-O46: un carnet sin snapshot no debe romper la generación del PDF.

`CarnetEmitidoModel.plantilla_version` es un entero; antes se accedía a
`.definicion` sobre él y la emisión devolvía 500. Se verifica que la definición
se resuelve contra la versión real del motor de plantillas.
"""
from types import SimpleNamespace

import pytest

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    PlantillaCarnetModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
    RepoCarnetizacionORM,
)

pytestmark = pytest.mark.django_db

DEFINICION = {
    "ancho_mm": 54.0,
    "alto_mm": 85.6,
    "anverso": [],
    "reverso": [],
    "bg": {"anverso": "#ffffff", "reverso": "#ffffff"},
}


def _plantilla(version: int = 1) -> PlantillaCarnetModel:
    TipoCredencialModel.objects.get_or_create(
        codigo="trabajador", defaults={"nombre": "Trabajador"}
    )
    return PlantillaCarnetModel.objects.create(
        nombre=f"Plantilla D1 v{version}",
        tipo_credencial_id="trabajador",
        version=version,
        estado="publicada",
        activa=True,
        definicion=DEFINICION,
    )


def test_resuelve_la_definicion_por_version_sin_snapshot():
    plantilla = _plantilla(version=1)
    fila = SimpleNamespace(
        plantilla_id=str(plantilla.id),
        plantilla_version=plantilla.version,
        plantilla_snapshot=None,
    )

    assert RepoCarnetizacionORM()._definicion_plantilla_emitida(fila) == DEFINICION


def test_resuelve_por_plantilla_raiz_cuando_el_id_es_de_la_version():
    raiz = _plantilla(version=1)
    version2 = PlantillaCarnetModel.objects.create(
        nombre="Plantilla D1 v2",
        tipo_credencial_id="trabajador",
        version=2,
        estado="publicada",
        activa=False,
        plantilla_raiz=raiz,
        definicion={**DEFINICION, "anverso": [{"id": "nuevo"}]},
    )
    fila = SimpleNamespace(
        plantilla_id=str(version2.id),
        plantilla_version=2,
        plantilla_snapshot=None,
    )

    definicion = RepoCarnetizacionORM()._definicion_plantilla_emitida(fila)
    assert definicion is not None
    assert definicion["anverso"] == [{"id": "nuevo"}]


def test_id_invalido_no_lanza_y_devuelve_none():
    fila = SimpleNamespace(
        plantilla_id="no-es-un-uuid",
        plantilla_version=1,
        plantilla_snapshot=None,
    )

    assert RepoCarnetizacionORM()._definicion_plantilla_emitida(fila) is None
