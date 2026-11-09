import core.infrastructure.models.base
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0004_campo_personalizado'),
    ]

    operations = [
        migrations.CreateModel(
            name='PreferenciaPrivacidadCarnetModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee_id', models.IntegerField(db_index=True, unique=True)),
                ('preferencias', models.JSONField(default=dict)),
            ],
            options={
                'verbose_name': 'preferencia de privacidad de carnet',
                'verbose_name_plural': 'preferencias de privacidad de carnet',
                'db_table': 'CarnetPrivacidadPreferencia',
            },
        ),
        migrations.CreateModel(
            name='BitacoraAccesoQrModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('security_hash', models.CharField(db_index=True, max_length=64)),
                ('carnet_id', models.IntegerField(blank=True, null=True)),
                ('accion', models.CharField(db_index=True, max_length=32)),
                ('usuario_id', models.IntegerField(blank=True, null=True)),
                ('ip', models.CharField(default='', max_length=45)),
                ('user_agent', models.TextField(blank=True, default='')),
            ],
            options={
                'verbose_name': 'bitácora de acceso qr',
                'verbose_name_plural': 'bitácora de accesos qr',
                'db_table': 'CarnetBitacoraAcceso',
                'ordering': ['-created_at'],
            },
        ),
    ]
