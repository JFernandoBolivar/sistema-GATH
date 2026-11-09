"""O41: el SQL de la migración crea la semilla histórica y es idempotente."""
from importlib import import_module

import pytest
from django.db import connection

from apps.autogestion.infrastructure.models.soporte_config_models import (
    ChecklistSoporteSeccionModel,
    TipoSoporteDocumentoModel,
)

pytestmark = pytest.mark.django_db


def _ejecutar_migracion():
    modulo = import_module('core.migrations.0018_tipos_documento_configurables')
    with connection.cursor() as cursor:
        cursor.execute(modulo.SQL_UP)


def test_sql_siembra_los_valores_actuales_y_no_duplica():
    _ejecutar_migracion()
    _ejecutar_migracion()

    assert TipoSoporteDocumentoModel.objects.count() == 6
    assert ChecklistSoporteSeccionModel.objects.count() == 17
    assert set(
        TipoSoporteDocumentoModel.objects.values_list('codigo', flat=True)
    ) == {'TITULO', 'ACTA_NACIMIENTO', 'CEDULA', 'CONSTANCIA', 'FOTO', 'OTRO'}
    assert all(
        TipoSoporteDocumentoModel.objects.values_list('es_reservado', 'es_protegido')
    )

    permitidos = {
        seccion: sorted(
            ChecklistSoporteSeccionModel.objects.filter(
                seccion=seccion, permitido=True,
            ).values_list('tipo_soporte__codigo', flat=True)
        )
        for seccion in (
            'identidad', 'contacto', 'vivienda', 'formacion', 'complementaria',
            'familiar', 'foto', 'antecedentes',
        )
    }
    assert permitidos == {
        'identidad': ['CEDULA'],
        'contacto': ['CONSTANCIA', 'OTRO'],
        'vivienda': ['CONSTANCIA', 'OTRO'],
        'formacion': ['CONSTANCIA', 'OTRO', 'TITULO'],
        'complementaria': ['CONSTANCIA', 'OTRO'],
        'familiar': ['ACTA_NACIMIENTO', 'CEDULA', 'CONSTANCIA', 'OTRO'],
        'foto': ['FOTO'],
        'antecedentes': ['CONSTANCIA', 'OTRO'],
    }
