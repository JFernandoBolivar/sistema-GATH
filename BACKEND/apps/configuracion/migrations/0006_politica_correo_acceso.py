import core.infrastructure.models.base
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0005_sembrar_versiones_imagen_cintillo'),
    ]

    operations = [
        migrations.CreateModel(
            name='PoliticaCorreoAccesoModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('politica_pasivos', models.CharField(choices=[('alternativo', 'Alternativo'), ('institucional', 'Institucional'), ('correo_ficha', 'Correo de la ficha')], default='alternativo', help_text='Fuente primaria de correo para pasivos y sobrevivientes.', max_length=20)),
                ('politica_activos', models.CharField(choices=[('alternativo', 'Alternativo'), ('institucional', 'Institucional'), ('correo_ficha', 'Correo de la ficha')], default='institucional', help_text='Fuente primaria de correo para personal activo.', max_length=20)),
                ('si_falta_elegido', models.CharField(choices=[('dejar_sin_cuenta', 'Dejar sin cuenta hasta que se cargue'), ('usar_siguiente', 'Usar el siguiente disponible')], default='dejar_sin_cuenta', help_text='Comportamiento cuando el correo de la fuente elegida no está cargado.', max_length=20)),
                ('avisar_al_aplicar_masivo', models.BooleanField(default=False, help_text='Si está activo, notifica por correo al aplicar masivamente los cambios.')),
                ('actualizado_por_id', models.IntegerField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'política de correo de acceso',
                'verbose_name_plural': 'políticas de correo de acceso',
                'db_table': 'configuracion_politica_correo_acceso',
            },
        ),
        migrations.CreateModel(
            name='ExcepcionCorreoAccesoModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cedula', models.CharField(db_index=True, max_length=20, unique=True)),
                ('motivo', models.TextField(blank=True, default='')),
                ('actor_cedula', models.CharField(blank=True, default='', max_length=20)),
            ],
            options={
                'verbose_name': 'excepción manual de correo de acceso',
                'verbose_name_plural': 'excepciones manuales de correo de acceso',
                'db_table': 'configuracion_excepcion_correo_acceso',
            },
        ),
    ]
