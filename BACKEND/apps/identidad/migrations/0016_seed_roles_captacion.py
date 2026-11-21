"""Siembra los permisos `postulacion.*` y los roles CAPTACION y DIRECCION_GENERAL (Fase 2, C-8).

Reutiliza `seed_permisos`, que es idempotente: crea los permisos y los roles nuevos, agrega los
permisos de postulación al rol PRESUPUESTO ya existente y se los da todos a ADMINISTRADOR. No
asigna ningún rol a personas. Al retroceder no se borra nada (los roles pueden tener usuarios).
"""
from django.core.management import call_command
from django.db import migrations


def aplicar(apps, schema_editor):
    call_command('seed_permisos', '--no-invalidar-sesiones')


class Migration(migrations.Migration):
    dependencies = [
        ('identidad', '0015_seed_campos_personalizados_carnet'),
    ]

    operations = [
        migrations.RunPython(aplicar, migrations.RunPython.noop),
    ]
