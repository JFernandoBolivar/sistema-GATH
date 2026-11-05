"""
A4 (2026-11-04): parentesco familiares vs contactos de emergencia.

Agrega la columna `aplica_familiar` (boolean, default true) a la tabla legada
`RAC_parentesco`. Los parentescos existentes quedan en true (permitidos para
familiares). Los parentescos creados para contactos de emergencia (uso='contacto')
se crearán con `aplica_familiar = false`.
"""
from django.db import migrations

SQL_AGREGAR = """
DO $$
BEGIN
    IF to_regclass('"RAC_parentesco"') IS NOT NULL THEN
        ALTER TABLE "RAC_parentesco" ADD COLUMN IF NOT EXISTS "aplica_familiar" boolean NOT NULL DEFAULT true;
    END IF;
END $$;
"""

SQL_QUITAR = """
DO $$
BEGIN
    IF to_regclass('"RAC_parentesco"') IS NOT NULL THEN
        ALTER TABLE "RAC_parentesco" DROP COLUMN IF EXISTS "aplica_familiar";
    END IF;
END $$;
"""


class Migration(migrations.Migration):
    dependencies = [("core", "0012_motivos_pase_a_pasivo")]

    operations = [
        migrations.RunSQL(SQL_AGREGAR, reverse_sql=SQL_QUITAR),
    ]
