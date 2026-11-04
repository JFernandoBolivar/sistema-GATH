"""
Serial del Carnet de la Patria: columna nueva en la tabla legada "Employee".

`EmployeeModel` es `managed = False`, así que `makemigrations` no la genera.
El ALTER es idempotente y solo corre si la tabla legada existe (en una base
recién creada no hay nada que ajustar).
"""
from django.db import migrations

SQL_AGREGAR = """
DO $$
BEGIN
    IF to_regclass('"Employee"') IS NOT NULL THEN
        ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "carnet_patria_serial" varchar(30) NULL;
    END IF;
END $$;
"""

SQL_QUITAR = """
DO $$
BEGIN
    IF to_regclass('"Employee"') IS NOT NULL THEN
        ALTER TABLE "Employee" DROP COLUMN IF EXISTS "carnet_patria_serial";
    END IF;
END $$;
"""


class Migration(migrations.Migration):
    dependencies = [("core", "0008_compat_esquema_legado")]

    operations = [
        migrations.RunSQL(SQL_AGREGAR, reverse_sql=SQL_QUITAR),
    ]
