"""Los importadores de Excel siguen leyendo pandas/openpyxl de forma diferida."""
import datetime

import pandas as pd
import pytest

from apps.cargos.infrastructure.importadores.carga_masiva_cargos_especiales import (
    _normalizar as normalizar_cargo,
)
from apps.personal.infrastructure.importadores.carga_masiva_empleados import (
    _parsear_fecha,
    importar_empleados_basico,
)
from apps.personal.infrastructure.importadores.carga_masiva_expediente import (
    _normalizar as normalizar_expediente,
)

pytestmark = pytest.mark.django_db


def test_los_helpers_usan_pandas_al_invocarse():
    assert _parsear_fecha("15/01/1960") == datetime.date(1960, 1, 15)
    assert normalizar_expediente("  ana   maria ") == "ANA MARIA"
    assert normalizar_cargo("  cargo  x ") == "CARGO X"


def test_importar_empleados_basico_lee_el_excel(monkeypatch):
    from apps.catalogos.infrastructure.models.catalogo_models import (
        EstadoCivilModel,
        NacionalidadModel,
        SexoModel,
    )

    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={"codigo": "V", "nombre": "VENEZOLANO"}
    )
    SexoModel.objects.get_or_create(pk=1, defaults={"sexo": "F"})
    EstadoCivilModel.objects.get_or_create(pk=1, defaults={"estadoCivil": "SOLTERO"})

    datos = pd.DataFrame(
        [
            {
                "CEDULA DE IDENTIDAD": "V-999001",
                "NOMBRES": "Ana",
                "APELLIDOS": "Pérez",
                "sexo": "F",
                "fecha_nacimiento": "15/01/1960",
            }
        ]
    )
    monkeypatch.setattr(pd, "read_excel", lambda archivo: datos)

    resultado = importar_empleados_basico("dummy.xlsx")

    assert resultado["procesados"] == 1
    assert resultado["errores"] == []
