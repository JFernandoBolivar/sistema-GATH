"""
Compatibilidad del esquema legado con los modelos nuevos (managed=False).

Las tablas `Employee`, `USER_cuenta` y `Nacionalidad` no las administra Django.
Esta migración ejecuta el DDL mínimo e idempotente que el arranque necesita
para que `preparar_produccion` no falle en una base heredada.

No se revierte: borrar la columna o la tabla destruiría datos de producción.
"""
from django.db import migrations

from core.infrastructure.schema.compat_legado import aplicar_compatibilidad


def _aplicar(apps, schema_editor):
    aplicar_compatibilidad(schema_editor.connection)


class Migration(migrations.Migration):
    dependencies = [("core", "0007_bootstrapstate")]

    operations = [
        migrations.RunPython(_aplicar, reverse_code=migrations.RunPython.noop),
    ]
