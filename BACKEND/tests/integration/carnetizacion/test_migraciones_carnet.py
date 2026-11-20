"""
Regresiones de migraciones de datos de carnetización (auditoría K-2 y K-3).

El proyecto no puede aplicar «todas las migraciones desde cero» en las pruebas (depende de
tablas heredadas restauradas; ver H-7), así que se prueban las funciones de las migraciones
directamente contra la base de pruebas.
"""
import importlib

import pytest
from django.apps import apps as apps_vivas
from django.db import connection, transaction

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetCicloModel,
    CarnetEmitidoModel,
    MotivosEmisionModel,
    PlantillaCarnetModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.repositories import repo_carnetizacion_comun as comun_mod
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

m0017 = importlib.import_module('apps.carnetizacion.migrations.0017_tipos_contratado_pasante_autoridad_y_legacy')
m0020 = importlib.import_module('apps.carnetizacion.migrations.0020_ciclo_de_carnets_anteriores')


class _Introspeccion:
    def __init__(self, tablas):
        self._tablas = tablas

    def table_names(self):
        return list(self._tablas)


class _EditorSinTabla:
    """schema_editor mínimo cuya base NO tiene la tabla heredada CarnetTemplate."""

    class connection:  # noqa: N801 - imita el atributo de Django
        introspection = _Introspeccion([])


class _AppsQueNoDebenUsarse:
    def get_model(self, *args):
        raise AssertionError('No se debe consultar CarnetTemplate si la tabla no existe (K-2).')


def test_0017_no_consulta_carnet_template_si_la_tabla_no_existe():
    """K-2: consultar una tabla inexistente aborta la transacción de la migración en PostgreSQL."""
    assert m0017._imagen_heredada_data_url(_AppsQueNoDebenUsarse(), _EditorSinTabla()) is None


def test_0017_siembra_tipos_y_legacy_sin_la_tabla_heredada():
    PlantillaCarnetModel.objects.filter(estado='LEGACY').delete()
    with transaction.atomic(), connection.schema_editor(atomic=False) as editor:
        m0017.sembrar_tipos_y_legacy(apps_vivas, editor)
        # La transacción sigue utilizable: no quedó abortada.
        assert PlantillaCarnetModel.objects.filter(estado='LEGACY').count() == 1
    legacy = PlantillaCarnetModel.objects.get(estado='LEGACY')
    assert legacy.definicion['caras'] == ['anverso']
    assert set(TipoCredencialModel.objects.values_list('codigo', flat=True)) >= {
        'contratado', 'pasante', 'autoridad',
    }


@pytest.fixture
def carnets_anteriores(django_db_setup, django_db_blocker, monkeypatch):
    with django_db_blocker.unblock():
        existentes = set(connection.introspection.table_names())
        with connection.schema_editor() as schema:
            for modelo in (MotivosEmisionModel, CarnetEmitidoModel):
                if modelo._meta.db_table not in existentes:
                    schema.create_model(modelo)
    monkeypatch.setattr(comun_mod, 'condicion_titular', lambda empleado: 'ACTIVO')
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'V'})
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='F')
    MotivosEmisionModel.objects.get_or_create(pk=1, defaults={'nombre': 'PRIMERA VEZ'})
    repo = RepoCarnetizacionORM()
    emitidos = []
    for cedula in ('7760001', '7760002', '7760003'):
        EmployeeModel.objects.create(cedulaidentidad=cedula, nombres='ANA', apellidos='ANTES',
                                     sexoid=sexo, nacionalidad_id=1)
        with transaction.atomic():
            emitidos.append(repo.emitir_carnet(cedula, 1))
    return emitidos


def test_0020_marca_entregados_solo_los_carnets_activos_sin_ciclo(carnets_anteriores):
    impreso, anulado, antiguo = carnets_anteriores
    repo = RepoCarnetizacionORM()
    repo.marcar_carnet_impreso(impreso.id, 'x')
    repo.anular_carnet(anulado.id, 'error', 'x')

    with connection.schema_editor(atomic=False) as editor:
        m0020.marcar_anteriores(apps_vivas, editor)
        m0020.marcar_anteriores(apps_vivas, editor)  # idempotente

    assert CarnetCicloModel.objects.get(carnet_id=antiguo.id).estado == 'ENTREGADO'
    assert CarnetCicloModel.objects.get(carnet_id=impreso.id).estado == 'IMPRESO'
    assert CarnetCicloModel.objects.get(carnet_id=anulado.id).estado == 'ANULADO'
    assert CarnetCicloModel.objects.filter(carnet_id=antiguo.id).count() == 1
    assert repo.cola_impresion_carnets() == []
