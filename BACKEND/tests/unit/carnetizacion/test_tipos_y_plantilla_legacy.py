"""B-7: catálogo de tipos nuevos y maqueta heredada sembrada como v1 LEGACY."""
import pytest

from apps.carnetizacion.domain.services.plantilla_defecto import NOMBRE_PLANTILLA_LEGACY
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    PlantillaCarnetModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
    RepoCarnetizacionORM,
)

pytestmark = pytest.mark.django_db


def test_tipos_contratado_pasante_y_autoridad_disponibles():
    repo = RepoCarnetizacionORM()
    tipos = {t.codigo: t for t in repo.listar_tipos_credencial()}
    for codigo in ('contratado', 'pasante', 'autoridad'):
        assert codigo in tipos
        assert tipos[codigo].activo is True
        assert tipos[codigo].grupo == 'trabajador'
        assert tipos[codigo].ancho_mm == 54.0
        assert tipos[codigo].alto_mm == 85.6
        assert tipos[codigo].orientacion == 'vertical'
    assert tipos['contratado'].orden < tipos['pasante'].orden < tipos['autoridad'].orden


def test_plantilla_legacy_sembrada_en_v1_sin_activarse():
    RepoCarnetizacionORM().listar_plantillas()  # las pruebas corren con --nomigrations
    legacy = PlantillaCarnetModel.objects.get(estado='LEGACY')
    assert legacy.nombre == NOMBRE_PLANTILLA_LEGACY
    assert legacy.version == 1
    assert legacy.activa is False
    assert legacy.estado == 'LEGACY'
    assert legacy.regla_criterio == 'legacy'
    assert legacy.definicion['legacy'] is True
    assert legacy.definicion['caras'] == ['anverso']
    ids = {el['id'] for el in legacy.definicion['anverso']}
    assert {'legacy-foto', 'legacy-qr', 'legacy-nombre', 'legacy-cedula'} <= ids


def test_sembrar_plantilla_legacy_es_idempotente():
    repo = RepoCarnetizacionORM()
    repo.listar_plantillas()
    repo.listar_plantillas()
    assert PlantillaCarnetModel.objects.filter(estado='LEGACY').count() == 1


def test_los_tipos_se_siembran_sin_duplicar():
    repo = RepoCarnetizacionORM()
    repo.listar_tipos_credencial()
    repo.listar_tipos_credencial()
    codigos = list(
        TipoCredencialModel.objects.filter(
            codigo__in=('contratado', 'pasante', 'autoridad')
        ).values_list('codigo', flat=True)
    )
    assert sorted(codigos) == ['autoridad', 'contratado', 'pasante']
