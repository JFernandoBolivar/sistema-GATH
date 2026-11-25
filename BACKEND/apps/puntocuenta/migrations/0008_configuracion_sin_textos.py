"""N-2: la configuración operativa deja de guardar textos y firmas.

Se conserva un respaldo migratorio de todas las filas para poder restaurar los
valores al retroceder. Las plantillas publicadas no se borran al revertir: pueden
respaldar documentos históricos y la siembra es idempotente.
"""
from django.db import migrations, models

CAMPOS_RETIRADOS = ('titulo', 'encabezado', 'cuerpo', 'firmas', 'mostrar_nivel', 'plantillas_procesos')


def _crear_tabla(apps, schema_editor):
    # El modelo es managed=False y su estado se declara en este mismo paso: aún no existe en `apps`,
    # así que la tabla se crea con SQL directo (idempotente).
    schema_editor.execute(
        'CREATE TABLE IF NOT EXISTS puntocuenta_configuracion_respaldo ('
        'configuracion_id uuid PRIMARY KEY, datos jsonb NOT NULL DEFAULT \'{}\'::jsonb)'
    )


def _eliminar_tabla(apps, schema_editor):
    schema_editor.execute('DROP TABLE IF EXISTS puntocuenta_configuracion_respaldo')


def _respaldo(apps, schema_editor):
    Config = apps.get_model('puntocuenta', 'ConfiguracionPuntoCuentaModel')
    Respaldo = apps.get_model('puntocuenta', 'RespaldoConfiguracionPuntoCuentaModel')
    for fila in Config.objects.all():
        Respaldo.objects.update_or_create(
            configuracion_id=fila.pk,
            defaults={'datos': {campo: getattr(fila, campo) for campo in CAMPOS_RETIRADOS}},
        )


def _restaurar(apps, schema_editor):
    Config = apps.get_model('puntocuenta', 'ConfiguracionPuntoCuentaModel')
    Respaldo = apps.get_model('puntocuenta', 'RespaldoConfiguracionPuntoCuentaModel')
    for respaldo in Respaldo.objects.all():
        fila = Config.objects.filter(pk=respaldo.configuracion_id).first()
        if fila is None:
            continue
        for campo, valor in respaldo.datos.items():
            setattr(fila, campo, valor)
        fila.save(update_fields=[*CAMPOS_RETIRADOS, 'updated_at'])
    Respaldo.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [  # noqa: RUF012
        ('puntocuenta', '0007_plantillas_punto_cuenta_datos'),
    ]

    operations = [  # noqa: RUF012
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(_crear_tabla, _eliminar_tabla)],
            state_operations=[migrations.CreateModel(
                name='RespaldoConfiguracionPuntoCuentaModel',
                fields=[
                    ('configuracion_id', models.UUIDField(primary_key=True, serialize=False)),
                    ('datos', models.JSONField(default=dict)),
                ],
                options={
                    'managed': False,
                    'db_table': 'puntocuenta_configuracion_respaldo',
                    'verbose_name': 'respaldo migratorio de configuración de punto de cuenta',
                    'verbose_name_plural': 'respaldos migratorios de configuración de punto de cuenta',
                },
            )],
        ),
        migrations.RunPython(_respaldo, _restaurar),
        *[
            migrations.RemoveField(model_name='configuracionpuntocuentamodel', name=campo)
            for campo in CAMPOS_RETIRADOS
        ],
    ]
