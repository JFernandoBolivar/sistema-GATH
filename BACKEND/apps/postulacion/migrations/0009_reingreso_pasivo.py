"""C-9: copia (snapshot) de `captacion.reingreso_pasivo` en el expediente. Los anteriores quedan en `permitir` (lo de siempre)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('postulacion', '0008_m1_flujo_configurable'),
    ]

    operations = [
        migrations.AddField(
            model_name='expedientepostulacionmodel',
            name='reingreso_pasivo',
            field=models.CharField(max_length=30, default='permitir'),
        ),
    ]
