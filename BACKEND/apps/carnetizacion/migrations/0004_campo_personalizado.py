import core.infrastructure.models.base
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0003_elemento_biblioteca'),
    ]

    operations = [
        migrations.CreateModel(
            name='CampoPersonalizadoModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('codigo', models.SlugField(max_length=50, unique=True)),
                ('etiqueta', models.CharField(max_length=100)),
                ('grupo', models.CharField(default='personalizado', max_length=50)),
                ('tipo_credencial', models.CharField(default='todos', max_length=50)),
                ('sensible', models.BooleanField(default=False)),
                ('descripcion', models.TextField(blank=True, default='')),
                ('valor_ejemplo', models.CharField(blank=True, default='', max_length=255)),
            ],
            options={
                'verbose_name': 'campo personalizado de carnet',
                'verbose_name_plural': 'campos personalizados de carnet',
                'db_table': 'CarnetCampoPersonalizado',
                'ordering': ['grupo', 'etiqueta'],
            },
        ),
    ]
