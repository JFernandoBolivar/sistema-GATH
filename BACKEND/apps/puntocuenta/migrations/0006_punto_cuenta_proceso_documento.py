"""N-2: el Punto de Cuenta guarda su proceso y el DocumentoGenerado que lo respalda (esquema)."""
from django.db import migrations, models
from django.db.models import Q


def _proteger_trazabilidad(apps, schema_editor):
    PuntoCuenta = apps.get_model('puntocuenta', 'PuntoCuentaModel')
    if PuntoCuenta.objects.filter(Q(proceso__gt='') | Q(documento_generado_id__isnull=False)).exists():
        raise RuntimeError(
            'No se puede revertir N-2: existen Puntos de Cuenta con proceso o DocumentoGenerado. '
            'Conserve la migración aplicada para no perder su trazabilidad.',
        )


class Migration(migrations.Migration):
    dependencies = [  # noqa: RUF012
        ('puntocuenta', '0005_configuracion_plantillas_procesos'),
    ]

    operations = [  # noqa: RUF012
        migrations.AddField(
            model_name='puntocuentamodel',
            name='proceso',
            field=models.CharField(blank=True, default='', max_length=60),
        ),
        migrations.AddField(
            model_name='puntocuentamodel',
            name='documento_generado_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.RunPython(migrations.RunPython.noop, _proteger_trazabilidad),
    ]
