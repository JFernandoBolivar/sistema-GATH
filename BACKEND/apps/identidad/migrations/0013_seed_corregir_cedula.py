"""Siembra el permiso `personal.corregir_cedula` (idempotente) y lo asigna a ADMINISTRADOR."""
from django.core.management import call_command
from django.db import migrations


def aplicar(apps, schema_editor):
    call_command('seed_permisos')


class Migration(migrations.Migration):
    dependencies = [
        ('identidad', '0012_ejecucionunicamodel'),
    ]

    operations = [
        migrations.RunPython(aplicar, migrations.RunPython.noop),
    ]
