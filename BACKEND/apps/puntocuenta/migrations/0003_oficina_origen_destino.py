from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('puntocuenta', '0002_indice_fecha'),
    ]

    operations = [
        migrations.AddField(
            model_name='puntocuentamodel',
            name='oficina_origen_id',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='puntocuentamodel',
            name='oficina_destino_id',
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
