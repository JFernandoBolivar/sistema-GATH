import uuid

import django.db.models.deletion
from django.db import migrations, models
import core.infrastructure.models.base


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='CargaMasivaModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('archivo_nombre', models.CharField(max_length=255)),
                ('archivo_clave', models.CharField(blank=True, default='', max_length=255)),
                ('tamano_bytes', models.PositiveBigIntegerField(default=0)),
                ('tipos', models.JSONField(blank=True, default=list)),
                ('modo', models.CharField(default='obligatorios', max_length=20)),
                ('estado', models.CharField(choices=[('EN_ANALISIS', 'En analisis'), ('ANALIZADA', 'Analizada'), ('APLICANDO', 'Aplicando'), ('APLICADA', 'Aplicada'), ('PENDIENTE_APROBACION', 'Pendiente de aprobacion'), ('RECHAZADA', 'Rechazada'), ('ERROR', 'Error'), ('REVERTIDA', 'Revertida')], default='EN_ANALISIS', max_length=24)),
                ('filas_total', models.PositiveIntegerField(default=0)),
                ('filas_validas', models.PositiveIntegerField(default=0)),
                ('filas_error', models.PositiveIntegerField(default=0)),
                ('solicitada_por_cedula', models.CharField(blank=True, default='', max_length=15)),
                ('aprobada_por_cedula', models.CharField(blank=True, default='', max_length=15)),
                ('motivo_rechazo', models.TextField(blank=True, default='')),
                ('analizada_en', models.DateTimeField(blank=True, null=True)),
                ('aplicada_en', models.DateTimeField(blank=True, null=True)),
                ('revertida_en', models.DateTimeField(blank=True, null=True)),
            ],
            options={'db_table': 'carga_masiva', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='CargaMasivaFilaModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('hoja', models.CharField(max_length=40)),
                ('tipo', models.CharField(max_length=40)),
                ('numero_fila', models.PositiveIntegerField()),
                ('estado', models.CharField(choices=[('NUEVO', 'Nuevo'), ('ACTUALIZAR', 'Actualizar'), ('SIN_CAMBIOS', 'Sin cambios'), ('ADVERTENCIA', 'Advertencia'), ('ERROR', 'Error')], max_length=15)),
                ('detalle', models.TextField(blank=True, default='')),
                ('datos', models.JSONField(blank=True, default=dict)),
                ('anteriores', models.JSONField(blank=True, default=dict)),
                ('aplicada', models.BooleanField(default=False)),
                ('error_aplicacion', models.TextField(blank=True, default='')),
                ('carga', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='filas', to='carga_masiva.cargamasivamodel')),
            ],
            options={'db_table': 'carga_masiva_fila', 'ordering': ['numero_fila']},
        ),
    ]
