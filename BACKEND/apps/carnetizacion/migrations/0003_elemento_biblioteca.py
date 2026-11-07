import core.infrastructure.models.base
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0002_carnet_emitido_version'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ElementoBibliotecaModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('nombre', models.CharField(max_length=150)),
                ('categoria', models.CharField(choices=[('logo', 'Logo'), ('firma', 'Firma'), ('imagen', 'Imagen')], db_index=True, max_length=20)),
                ('archivo_clave', models.CharField(max_length=255)),
                ('nombre_archivo', models.CharField(default='', max_length=255)),
                ('tamano_bytes', models.PositiveIntegerField()),
                ('mime_type', models.CharField(max_length=50)),
                ('ancho_px', models.PositiveIntegerField(blank=True, null=True)),
                ('alto_px', models.PositiveIntegerField(blank=True, null=True)),
                ('descripcion', models.TextField(blank=True, default='')),
                ('creado_por', models.ForeignKey(blank=True, db_column='creadoPorId', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'elemento de biblioteca',
                'verbose_name_plural': 'elementos de biblioteca',
                'db_table': 'CarnetElementoBiblioteca',
                'ordering': ['categoria', '-created_at'],
            },
        ),
    ]
