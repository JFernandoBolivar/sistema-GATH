"""
Tests unitarios (sin BD) de las reglas de negocio del alta/edición de un
familiar -- paridad con `RAC/services/family_services.py` del legado.
"""
from datetime import date

import pytest

from apps.familiares.application.use_cases.validaciones_familiar import (
    es_menor_de_9_anios,
    resolver_cedula_familiar,
    validar_cedula_no_duplicada,
    validar_heredero_unico,
)


def test_es_menor_de_9_anios_true():
    assert es_menor_de_9_anios(date(2022, 1, 1), hoy=date(2026, 1, 1)) is True


def test_es_menor_de_9_anios_false():
    assert es_menor_de_9_anios(date(2010, 1, 1), hoy=date(2026, 1, 1)) is False


def test_resolver_cedula_familiar_usa_la_cedula_dada():
    cedula = resolver_cedula_familiar(
        cedula_familiar="87654321",
        cedula_empleado="12345678",
        es_hijo=False,
        fecha_nacimiento=None,
        siguiente_orden_hijo=1,
    )
    assert cedula == "87654321"


def test_resolver_cedula_familiar_rechaza_igual_al_empleado():
    with pytest.raises(ValueError, match="no puede ser igual"):
        resolver_cedula_familiar(
            cedula_familiar="12345678",
            cedula_empleado="12345678",
            es_hijo=False,
            fecha_nacimiento=None,
            siguiente_orden_hijo=1,
        )


def test_resolver_cedula_familiar_genera_sintetica_para_hijo_menor():
    cedula = resolver_cedula_familiar(
        cedula_familiar=None,
        cedula_empleado="12345678",
        es_hijo=True,
        fecha_nacimiento=date(2022, 1, 1),
        siguiente_orden_hijo=3,
    )
    assert cedula == "12345678-3"


def test_resolver_cedula_familiar_falla_sin_cedula_si_no_es_hijo():
    with pytest.raises(ValueError, match="obligatoria"):
        resolver_cedula_familiar(
            cedula_familiar=None,
            cedula_empleado="12345678",
            es_hijo=False,
            fecha_nacimiento=date(1990, 1, 1),
            siguiente_orden_hijo=1,
        )


def test_resolver_cedula_familiar_falla_hijo_mayor_de_9_sin_cedula():
    with pytest.raises(ValueError, match="obligatoria"):
        resolver_cedula_familiar(
            cedula_familiar=None,
            cedula_empleado="12345678",
            es_hijo=True,
            fecha_nacimiento=date(2000, 1, 1),
            siguiente_orden_hijo=1,
        )


def test_validar_cedula_no_duplicada_ok():
    validar_cedula_no_duplicada("11111111", {"22222222", "33333333"})


def test_validar_cedula_no_duplicada_falla():
    with pytest.raises(ValueError, match="ya se encuentra registrado"):
        validar_cedula_no_duplicada("11111111", {"11111111"})


def test_validar_heredero_unico_ok_sin_heredero_nuevo():
    validar_heredero_unico(False, True)


def test_validar_heredero_unico_ok_sin_heredero_previo():
    validar_heredero_unico(True, False)


def test_validar_heredero_unico_falla_si_ya_existe():
    with pytest.raises(ValueError, match="ya posee un familiar registrado como heredero"):
        validar_heredero_unico(True, True)
