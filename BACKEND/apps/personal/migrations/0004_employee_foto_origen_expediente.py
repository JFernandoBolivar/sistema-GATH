from django.db import migrations


class Migration(migrations.Migration):
    """Fase 2 (G-5): agrega a `Employee` la foto con metadatos y el origen del expediente de postulación.

    `Employee` es una tabla heredada (`managed=False`), así que el cambio va por SQL directo, como las demás
    columnas agregadas a tablas heredadas (p. ej. `CarnetEmitido.fecha_vencimiento`). Es seguro en producción:
      * solo columnas NULLABLE sin valor por defecto -> en PostgreSQL es un cambio de catálogo, sin reescribir
        la tabla ni bloquearla más que un instante;
      * `IF NOT EXISTS`: se puede reejecutar sobre una base donde ya estén;
      * `origen_expediente` es un UUID SIN clave foránea (`personal` no conoce `postulacion`).
    Las filas existentes quedan en NULL.
    """

    dependencies = [
        ('personal', '0003_normalizar_ciudad_region'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS foto_objeto VARCHAR(120) NULL;'
                'ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS foto_actualizada TIMESTAMPTZ NULL;'
                'ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS origen_expediente UUID NULL;'
            ),
            reverse_sql=(
                'ALTER TABLE "Employee" DROP COLUMN IF EXISTS origen_expediente;'
                'ALTER TABLE "Employee" DROP COLUMN IF EXISTS foto_actualizada;'
                'ALTER TABLE "Employee" DROP COLUMN IF EXISTS foto_objeto;'
            ),
        ),
    ]
