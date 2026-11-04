import core.infrastructure.models.base
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='TrabajoExportacionModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('solicitante_id', models.IntegerField(blank=True, null=True)),
                ('solicitante_cedula', models.CharField(blank=True, default='', max_length=20)),
                ('tipo', models.CharField(max_length=40)),
                ('formato', models.CharField(max_length=10)),
                ('estado', models.CharField(default='PENDIENTE', max_length=12)),
                ('progreso', models.PositiveSmallIntegerField(default=0)),
                ('parametros', models.JSONField(default=dict)),
                ('task_id', models.CharField(blank=True, default='', max_length=64)),
                ('clave_archivo', models.CharField(blank=True, default='', max_length=200)),
                ('nombre_archivo', models.CharField(blank=True, default='', max_length=120)),
                ('tamano_bytes', models.BigIntegerField(default=0)),
                ('metadatos', models.JSONField(default=dict)),
                ('error', models.CharField(blank=True, default='', max_length=300)),
                ('expira_en', models.DateTimeField()),
                ('finalizado_en', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'db_table': 'exportaciones_trabajo',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['solicitante_id', 'estado'], name='export_solic_estado_idx'),
                    models.Index(fields=['estado', 'expira_en'], name='export_estado_expira_idx'),
                ],
            },
        ),
    ]
