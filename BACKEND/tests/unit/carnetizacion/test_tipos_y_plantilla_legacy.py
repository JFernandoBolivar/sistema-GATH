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


def test_no_hay_tipos_de_credencial_por_nomina():
    """K-11: contratado, pasante (y autoridad) no son tipos de credencial: son nóminas, y su
    diseño sale de la regla por tipo de nómina de la plantilla «trabajador»."""
    tipos = {t.codigo for t in RepoCarnetizacionORM().listar_tipos_credencial(solo_activos=False)}
    assert {'trabajador', 'pasivo'} <= tipos
    assert not tipos & {'contratado', 'pasante', 'autoridad'}


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
    assert codigos == []
