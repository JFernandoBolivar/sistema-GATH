"""Compatibilidad de la cadena: los datos de procesos ya migran en `0003_catalogo_procesos`."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('documentos', '0003_catalogo_procesos'),
    ]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
