from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fe_de_vida', '0009_solicitud_sin_correo_alternativo'),
    ]

    operations = [
        migrations.AddField(
            model_name='ConstanciaFeDeVidaModel',
            name='datos_planilla',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
