"""B-7: retira ``CarnetTemplateModel`` del estado de migraciones.

El modelo se declaró con ``managed=False``, así que el ``DeleteModel`` solo
elimina su estado: Django no borra la tabla física ``CarnetTemplate``. La tabla
se conserva como archivo histórico, pero el código deja de leerla; la maqueta
heredada ya quedó sembrada como plantilla v1 LEGACY en la migración 0017.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0017_tipos_contratado_pasante_autoridad_y_legacy'),
    ]

    operations = [
        migrations.DeleteModel(
            name='CarnetTemplateModel',
        ),
    ]
