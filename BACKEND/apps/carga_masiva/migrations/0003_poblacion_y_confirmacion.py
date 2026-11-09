from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('carga_masiva', '0002_alter_cargamasivafilamodel_estado_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='cargamasivamodel',
            name='poblacion',
            field=models.CharField(
                choices=[('ACTIVOS', 'Activos'), ('PASIVOS', 'Pasivos')],
                default='ACTIVOS',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='cargamasivamodel',
            name='filas_confirmacion',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='cargamasivamodel',
            name='filas_confirmadas',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='cargamasivafilamodel',
            name='movimiento',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='cargamasivafilamodel',
            name='confirmada',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='cargamasivafilamodel',
            name='confirmada_por_cedula',
            field=models.CharField(blank=True, default='', max_length=15),
        ),
        migrations.AddField(
            model_name='cargamasivafilamodel',
            name='confirmada_en',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='cargamasivafilamodel',
            name='estado',
            field=models.CharField(
                choices=[
                    ('NUEVO', 'Nuevo'),
                    ('ACTUALIZAR', 'Actualizar'),
                    ('SIN_CAMBIOS', 'Sin Cambios'),
                    ('ADVERTENCIA', 'Advertencia'),
                    ('REQUIERE_CONFIRMACION', 'Requiere Confirmacion'),
                    ('ERROR', 'Error'),
                ],
                max_length=24,
            ),
        ),
    ]
