import core.infrastructure.models.base
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fe_de_vida', '0007_solicitud_canal_registrada_por'),
    ]

    operations = [
        migrations.CreateModel(
            name='GuiaFeDeVidaVistaModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cedula', models.CharField(db_index=True, max_length=15)),
                ('proceso', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='guias_vistas', to='fe_de_vida.procesofedevidamodel')),
            ],
            options={
                'verbose_name': 'guía de fe de vida vista',
                'verbose_name_plural': 'guías de fe de vida vistas',
                'db_table': 'fe_de_vida_guia_vista',
            },
        ),
        migrations.AddConstraint(
            model_name='guiafedevidavistamodel',
            constraint=models.UniqueConstraint(fields=('proceso', 'cedula'), name='fv_guia_vista_proceso_cedula_uniq'),
        ),
    ]
