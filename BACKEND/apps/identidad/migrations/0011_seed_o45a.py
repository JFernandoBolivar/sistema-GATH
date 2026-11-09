"""O45-A: vuelve a ejecutar el seed para crear los permisos nuevos."""
from django.core.management import call_command
from django.db import migrations


def aplicar(apps, schema_editor):
    call_command('seed_permisos')


class Migration(migrations.Migration):
    dependencies = [
        ('identidad', '0011_nombre_visible_rol'),
    ]

    operations = [
        migrations.RunPython(aplicar, migrations.RunPython.noop),
    ]
