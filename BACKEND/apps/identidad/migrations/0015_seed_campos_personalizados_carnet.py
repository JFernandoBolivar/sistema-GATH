"""Siembra `carnetizacion.campos_personalizados` (Gestionar campos personalizados del carnet).

Crear, editar y eliminar campos personalizados del carnet deja de colgar de
`carnetizacion.disenar`. ADMINISTRADOR lo recibe por el seed del catálogo (recibe todo);
a los demás roles no se les asigna nada.
"""
from django.core.management import call_command
from django.db import migrations


def aplicar(apps, schema_editor):
    call_command('seed_permisos')


class Migration(migrations.Migration):
    dependencies = [
        ('identidad', '0014_seed_editar_nacionalidad'),
    ]

    operations = [
        migrations.RunPython(aplicar, migrations.RunPython.noop),
    ]
