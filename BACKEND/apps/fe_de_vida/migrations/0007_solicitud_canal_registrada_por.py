from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fe_de_vida', '0006_reenvio_constancia'),
    ]

    operations = [
        migrations.AddField(
            model_name='solicitudfedevidamodel',
            name='canal',
            field=models.CharField(choices=[('EN_LINEA', 'En línea'), ('PRESENCIAL', 'Presencial')], default='EN_LINEA', max_length=20),
        ),
        migrations.AddField(
            model_name='solicitudfedevidamodel',
            name='registrada_por',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='solicitudfedevidamodel',
            name='registrada_por_cedula',
            field=models.CharField(blank=True, default='', max_length=15),
        ),
    ]
