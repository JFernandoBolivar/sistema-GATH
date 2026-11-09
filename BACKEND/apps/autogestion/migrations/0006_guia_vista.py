# Generated manually for O35 - Guías interactivas en autogestión

import core.infrastructure.models.base
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('autogestion', '0005_secciones_identidad_salud'),
    ]

    operations = [
        migrations.CreateModel(
            name='GuiaVistaModel',
            fields=[
                (
                    'id',
                    models.UUIDField(
                        default=core.infrastructure.models.base.uuid7,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cedula', models.CharField(db_index=True, max_length=15)),
                ('guia_id', models.CharField(db_index=True, max_length=64)),
                ('version', models.PositiveIntegerField(default=1)),
            ],
            options={
                'verbose_name': 'guía interactiva vista',
                'verbose_name_plural': 'guías interactivas vistas',
                'db_table': 'autogestion_guia_vista',
            },
        ),
        migrations.AddConstraint(
            model_name='guiavistamodel',
            constraint=models.UniqueConstraint(
                fields=('cedula', 'guia_id', 'version'),
                name='ag_guia_vista_cedula_guia_ver_uniq',
            ),
        ),
    ]
