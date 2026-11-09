from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fe_de_vida', '0008_guia_fe_de_vida_vista'),
    ]

    operations = [
        migrations.AddField(
            model_name='solicitudfedevidamodel',
            name='sin_correo_alternativo',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='solicitudfedevidamodel',
            name='justificacion_sin_correo',
            field=models.TextField(blank=True, default=''),
        ),
    ]
