"""
TLF-1: orden de nacimiento de los hijos menores sin cédula propia.

Agrega la columna nullable `ordenHijo` a la tabla legada
`RAC_employeefamily`. Es solo aditiva: las cédulas sintéticas ya generadas
(578) quedan con NULL y no se recalculan ni se rellenan.
"""
from django.db import migrations

SQL_AGREGAR = """
DO $$
BEGIN
    IF to_regclass('"RAC_employeefamily"') IS NOT NULL THEN
        ALTER TABLE "RAC_employeefamily"
            ADD COLUMN IF NOT EXISTS "ordenHijo" smallint NULL;
    END IF;
END $$;
"""

SQL_QUITAR = """
DO $$
BEGIN
    IF to_regclass('"RAC_employeefamily"') IS NOT NULL THEN
        ALTER TABLE "RAC_employeefamily" DROP COLUMN IF EXISTS "ordenHijo";
    END IF;
END $$;
"""


class Migration(migrations.Migration):
    dependencies = [("core", "0015_motivos_movimiento_activo_y_deduplicacion")]

    operations = [
        migrations.RunSQL(SQL_AGREGAR, reverse_sql=SQL_QUITAR),
    ]
