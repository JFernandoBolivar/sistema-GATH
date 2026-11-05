from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('puntocuenta', '0004_configuracion_punto_cuenta_y_correlativo'),
    ]

    operations = [
        migrations.AddField(
            model_name='configuracionpuntocuentamodel',
            name='plantillas_procesos',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
