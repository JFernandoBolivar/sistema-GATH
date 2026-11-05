import core.infrastructure.models.base
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('fe_de_vida', '0005_plantilla_constancia_v2'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReenvioConstanciaModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('actor_cedula', models.CharField(max_length=15)),
                ('destinatario', models.EmailField(max_length=254)),
                ('copia', models.EmailField(blank=True, default='', max_length=254)),
                ('fecha', models.DateField(db_index=True)),
                ('constancia', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reenvios', to='fe_de_vida.constanciafedevidamodel')),
            ],
            options={
                'verbose_name': 'reenvío de constancia',
                'verbose_name_plural': 'reenvíos de constancia',
                'db_table': 'fe_de_vida_reenvio_constancia',
                'ordering': ['-created_at'],
            },
        ),
    ]
