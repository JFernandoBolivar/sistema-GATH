"""O45-A: credenciales externas/temporales y grupo del catálogo de tipos."""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import core.infrastructure.models.base


def sembrar_tipos(apps, schema_editor):
    Tipo = apps.get_model('carnetizacion', 'TipoCredencialModel')
    base = [
        {
            'codigo': 'trabajador',
            'nombre': 'Trabajador Activo',
            'descripcion': 'Credencial oficial para personal activo institucional',
            'grupo': 'trabajador',
            'orden': 1,
        },
        {
            'codigo': 'pasivo',
            'nombre': 'Pasivo / Jubilado / Pensionado',
            'descripcion': 'Credencial oficial para personal jubilado, pensionado o sobreviviente',
            'grupo': 'pasivo',
            'orden': 2,
        },
        {
            'codigo': 'visitante',
            'nombre': 'Visitante',
            'descripcion': 'Credencial temporal para visitantes en recepción',
            'grupo': 'externo',
            'orden': 10,
        },
        {
            'codigo': 'contratista',
            'nombre': 'Contratista / Proveedor',
            'descripcion': 'Credencial temporal para contratistas y proveedores',
            'grupo': 'externo',
            'orden': 11,
        },
        {
            'codigo': 'trabajador_temporal',
            'nombre': 'Credencial temporal de trabajador',
            'descripcion': 'Credencial corta por olvido o extravío del carnet institucional',
            'grupo': 'temporal',
            'orden': 12,
        },
    ]
    for datos in base:
        Tipo.objects.get_or_create(
            codigo=datos['codigo'],
            defaults={
                'nombre': datos['nombre'],
                'descripcion': datos['descripcion'],
                'grupo': datos['grupo'],
                'ancho_mm': 54.00,
                'alto_mm': 85.60,
                'orientacion': 'vertical',
                'activo': True,
                'orden': datos['orden'],
            },
        )
    Tipo.objects.filter(codigo='trabajador').update(grupo='trabajador')
    Tipo.objects.filter(codigo='pasivo').update(grupo='pasivo')


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0005_privacidad_y_bitacora_qr'),
    ]

    operations = [
        migrations.AddField(
            model_name='tipocredencialmodel',
            name='grupo',
            field=models.CharField(db_index=True, default='trabajador', max_length=30),
        ),
        migrations.CreateModel(
            name='CredencialExternaModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('nombre', models.CharField(max_length=150)),
                ('documento', models.CharField(db_index=True, max_length=50)),
                ('correo', models.EmailField(blank=True, default='', max_length=254)),
                ('empresa', models.CharField(blank=True, default='', max_length=150)),
                ('contrato', models.CharField(blank=True, default='', max_length=100)),
                ('persona_visitada', models.CharField(blank=True, default='', max_length=150)),
                ('motivo', models.CharField(max_length=200)),
                ('vigencia_desde', models.DateTimeField()),
                ('vigencia_hasta', models.DateTimeField(db_index=True)),
                ('estado', models.CharField(choices=[('ACTIVA', 'Activa'), ('DEVUELTA', 'Devuelta'), ('ANULADA', 'Anulada'), ('VENCIDA', 'Vencida')], db_index=True, default='ACTIVA', max_length=20)),
                ('security_hash', models.CharField(db_index=True, max_length=64, unique=True)),
                ('datos', models.JSONField(blank=True, default=dict)),
                ('plantilla_id', models.CharField(blank=True, default='', max_length=64)),
                ('plantilla_version', models.PositiveIntegerField(blank=True, null=True)),
                ('plantilla_snapshot', models.JSONField(blank=True, null=True)),
                ('observaciones', models.TextField(blank=True, default='')),
                ('devuelta_en', models.DateTimeField(blank=True, null=True)),
                ('anulada_en', models.DateTimeField(blank=True, null=True)),
                ('creado_por', models.ForeignKey(blank=True, db_column='creadoPorId', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('empleado', models.ForeignKey(blank=True, db_column='empleadoId', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='credenciales_externas', to='personal.employeemodel')),
                ('tipo_credencial', models.ForeignKey(db_column='tipoCredencialCodigo', on_delete=django.db.models.deletion.PROTECT, related_name='credenciales_externas', to='carnetizacion.tipocredencialmodel')),
            ],
            options={
                'verbose_name': 'credencial externa o temporal',
                'verbose_name_plural': 'credenciales externas o temporales',
                'db_table': 'CarnetCredencialExterna',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='credencialexternamodel',
            index=models.Index(fields=['estado', 'vigencia_hasta'], name='cce_estado_vig_idx'),
        ),
        migrations.AddIndex(
            model_name='credencialexternamodel',
            index=models.Index(fields=['tipo_credencial', 'created_at'], name='cce_tipo_creado_idx'),
        ),
        migrations.RunPython(sembrar_tipos, migrations.RunPython.noop),
    ]
