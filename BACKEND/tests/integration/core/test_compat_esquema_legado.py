"""Compatibilidad del esquema legado: debe poder aplicarse varias veces."""
import pytest
from django.db import connection

from core.infrastructure.schema.compat_legado import aplicar_compatibilidad

pytestmark = pytest.mark.django_db


def test_aplicar_compatibilidad_es_idempotente():
    aplicar_compatibilidad(connection)
    aplicar_compatibilidad(connection)

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT count(*) FROM "Nacionalidad" WHERE codigo IN (%s, %s)',
            ["V", "E"],
        )
        assert cursor.fetchone()[0] == 2

        cursor.execute(
            """
            SELECT character_maximum_length
              FROM information_schema.columns
             WHERE table_name = 'USER_cuenta' AND column_name = 'password'
            """
        )
        assert cursor.fetchone()[0] >= 255

        cursor.execute(
            """
            SELECT 1
              FROM information_schema.columns
             WHERE table_name = 'Employee' AND column_name = 'nacionalidadId'
            """
        )
        assert cursor.fetchone() is not None
