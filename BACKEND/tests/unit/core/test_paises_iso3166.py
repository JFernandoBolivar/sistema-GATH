"""D4/FIX-O46: la migración siembra ISO 3166-1 completo, sin duplicados."""
import importlib
import re

import pytest
from django.db import connection

MIGRACION = importlib.import_module("core.migrations.0019_sembrar_paises_iso3166")


def test_lista_iso3166_completa_y_sin_duplicados():
    paises = MIGRACION.PAISES

    assert len(paises) == 249
    codigos = [codigo for _, codigo in paises]
    nombres = [nombre for nombre, _ in paises]
    assert len(set(codigos)) == 249
    assert len(set(nombres)) == 249
    assert all(re.fullmatch(r"[A-Z]{2}", codigo) for codigo in codigos)


def test_venezuela_primero_y_marcada_como_tal():
    nombre, codigo = MIGRACION.PAISES[0]

    assert (nombre, codigo) == ("Venezuela", "VE")
    assert "('Venezuela', 'VE', true)" in MIGRACION.SQL_UP


def test_sql_es_idempotente():
    assert MIGRACION.SQL_UP.rstrip().endswith("ON CONFLICT DO NOTHING;")


@pytest.mark.django_db
def test_sql_siembra_los_paises_y_puede_repetirse():
    with connection.cursor() as cursor:
        cursor.execute(MIGRACION.SQL_UP)
        cursor.execute(MIGRACION.SQL_UP)  # idempotente
        cursor.execute('SELECT count(*) FROM "Pais"')
        total = cursor.fetchone()[0]
        cursor.execute(
            'SELECT "es_venezuela" FROM "Pais" WHERE "codigo" = %s', ["VE"]
        )
        es_venezuela = cursor.fetchone()[0]
        cursor.execute('SELECT "nombre" FROM "Pais" WHERE "codigo" = %s', ["CL"])
        chile = cursor.fetchone()[0]

    assert total >= 249
    assert es_venezuela is True
    assert chile == "Chile"
