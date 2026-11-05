import core.infrastructure.models.base
from django.db import migrations, models
import apps.puntocuenta.infrastructure.models.configuracion_punto_cuenta_model


class Migration(migrations.Migration):

    dependencies = [
        ('puntocuenta', '0003_oficina_origen_destino'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConfiguracionPuntoCuentaModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('procesos_habilitados', models.JSONField(default=apps.puntocuenta.infrastructure.models.configuracion_punto_cuenta_model._defecto_procesos)),
                ('titulo', models.CharField(default='PUNTO DE CUENTA', max_length=200)),
                ('encabezado', models.TextField(blank=True, default='Para su conocimiento y fines pertinentes, se notifica el siguiente movimiento de personal:')),
                ('cuerpo', models.TextField(blank=True, default='Por medio del presente punto de cuenta, se deja constancia del movimiento del funcionario {nombre}, titular de la cédula de identidad N.º {cedula}, en el cargo {cargo}. Movimiento desde {origen} hacia {destino}, con fecha {fecha} y motivo {motivo}, bajo el Punto de Cuenta N.º {numero}.')),
                ('firmas', models.JSONField(default=apps.puntocuenta.infrastructure.models.configuracion_punto_cuenta_model._defecto_firmas)),
                ('mostrar_nivel', models.BooleanField(default=True)),
                ('version', models.IntegerField(default=1)),
                ('actualizado_por_id', models.IntegerField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'configuración de punto de cuenta',
                'verbose_name_plural': 'configuraciones de punto de cuenta',
                'db_table': 'puntocuenta_configuracion',
                'ordering': ['-version'],
            },
        ),
        migrations.CreateModel(
            name='SecuenciaPuntoCuentaModel',
            fields=[
                ('anio', models.IntegerField(primary_key=True, serialize=False)),
                ('ultimo_numero', models.IntegerField(default=0)),
            ],
            options={
                'verbose_name': 'secuencia de punto de cuenta',
                'verbose_name_plural': 'secuencias de puntos de cuenta',
                'db_table': 'puntocuenta_secuencia',
            },
        ),
        migrations.AddField(
            model_name='puntocuentamodel',
            name='anio',
            field=models.IntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='puntocuentamodel',
            name='configuracion_version',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='puntocuentamodel',
            name='division_destino_id',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='puntocuentamodel',
            name='division_origen_id',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='puntocuentamodel',
            name='numero',
            field=models.CharField(blank=True, db_index=True, max_length=30, null=True),
        ),
        migrations.AddField(
            model_name='puntocuentamodel',
            name='secuencia',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='puntocuentamodel',
            name='snapshot_formato',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
