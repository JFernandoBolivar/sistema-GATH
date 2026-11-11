from django.db import migrations


class Migration(migrations.Migration):
    """Agrega `CarnetEmitido.fecha_vencimiento` (nullable; tabla `managed=False`).

    Los carnets anteriores quedan con NULL y su vencimiento se calcula en lectura.
    """

    dependencies = [
        ('carnetizacion', '0009_actualizar_plantillas_institucionales'),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE "CarnetEmitido" ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ NULL;',
            reverse_sql='ALTER TABLE "CarnetEmitido" DROP COLUMN IF EXISTS fecha_vencimiento;',
        ),
    ]
