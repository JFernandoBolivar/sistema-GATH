import core.infrastructure.models.base
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0003_sembrar_parametros_sistema'),
    ]

    operations = [
        migrations.CreateModel(
            name='VersionImagenCintilloModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('campo', models.CharField(max_length=30)),
                ('clave', models.CharField(max_length=255)),
                ('mime', models.CharField(default='application/octet-stream', max_length=100)),
                ('tamano', models.PositiveIntegerField(default=0)),
                ('subido_por_id', models.IntegerField(blank=True, null=True)),
                ('subido_por_cedula', models.CharField(blank=True, default='', max_length=20)),
                ('es_vigente', models.BooleanField(default=False)),
            ],
            options={
                'verbose_name': 'versión de imagen del cintillo',
                'verbose_name_plural': 'versiones de imágenes del cintillo',
                'db_table': 'configuracion_version_imagen_cintillo',
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['campo', '-created_at'], name='configuraci_campo_d7bf80_idx')],
            },
        ),
    ]
