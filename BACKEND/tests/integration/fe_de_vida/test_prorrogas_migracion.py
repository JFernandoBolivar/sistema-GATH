"""Backfill de la migración 0011: una sola prórroga vigente por alcance."""
from datetime import timedelta
from importlib import import_module

import pytest
from django.apps import apps as django_apps
from django.utils import timezone

from apps.fe_de_vida.infrastructure.models.proceso_models import (
    ProcesoFeDeVidaModel,
    ProrrogaProcesoModel,
)

migracion = import_module('apps.fe_de_vida.migrations.0011_prorroga_reemplazada')


@pytest.mark.django_db
def test_backfill_deja_una_vigente_por_alcance_y_conserva_historial():
    ahora = timezone.now()
    proceso = ProcesoFeDeVidaModel.objects.create(
        nombre='Jornada fe de vida',
        fecha_apertura=ahora - timedelta(days=10),
        fecha_cierre=ahora - timedelta(days=1),
        estado='CERRADO',
    )
    generales = [
        ProrrogaProcesoModel.objects.create(
            proceso=proceso, cedula='', nueva_fecha_limite=ahora + timedelta(days=dias),
            motivo=f'General {dias}', concedida_por='1',
        )
        for dias in (1, 2, 3, 4)
    ]
    individuales = [
        ProrrogaProcesoModel.objects.create(
            proceso=proceso, cedula='12345678', nueva_fecha_limite=ahora + timedelta(days=dias),
            motivo=f'Individual {dias}', concedida_por='1',
        )
        for dias in (2, 5)
    ]

    migracion.marcar_reemplazadas(django_apps, None)

    generales = [ProrrogaProcesoModel.objects.get(pk=p.pk) for p in generales]
    individuales = [ProrrogaProcesoModel.objects.get(pk=p.pk) for p in individuales]
    vigente_general = next(p for p in generales if p.reemplazada_por_id is None)
    assert vigente_general.nueva_fecha_limite == ahora + timedelta(days=4)
    assert sum(1 for p in generales if p.reemplazada_por_id == vigente_general.pk) == 3
    vigente_individual = next(p for p in individuales if p.reemplazada_por_id is None)
    assert vigente_individual.nueva_fecha_limite == ahora + timedelta(days=5)
    assert sum(1 for p in individuales if p.reemplazada_por_id == vigente_individual.pk) == 1
    assert ProrrogaProcesoModel.objects.filter(proceso=proceso).count() == 6
