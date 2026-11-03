"""
Seed real de permisos, al final de la cadena de identidad.

`0003_seed_permisos` ejecutaba el comando antes de que existieran
`identidad_cuenta_permisos_version` (0007) y `auditoria_log` (core), por lo que
una base nueva fallaba. Esta migración corre el seed cuando todas las tablas
están creadas y deja `0003` como no-op.

Es idempotente: el seed solo crea lo que falta.
"""
from django.core.management import call_command
from django.db import migrations


def aplicar_seed_final(apps, schema_editor):
    call_command('seed_permisos')


class Migration(migrations.Migration):
    dependencies = [
        ('identidad', '0009_desactivacion_egreso_cuenta'),
        ('core', '0008_compat_esquema_legado'),
    ]

    operations = [
        migrations.RunPython(aplicar_seed_final, migrations.RunPython.noop),
    ]
