from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE "CarnetEmitido" ADD COLUMN IF NOT EXISTS plantilla_id VARCHAR(64);
            ALTER TABLE "CarnetEmitido" ADD COLUMN IF NOT EXISTS plantilla_version INTEGER;
            ALTER TABLE "CarnetEmitido" ADD COLUMN IF NOT EXISTS plantilla_snapshot JSONB;
            """,
            reverse_sql="""
            ALTER TABLE "CarnetEmitido" DROP COLUMN IF EXISTS plantilla_id;
            ALTER TABLE "CarnetEmitido" DROP COLUMN IF EXISTS plantilla_version;
            ALTER TABLE "CarnetEmitido" DROP COLUMN IF EXISTS plantilla_snapshot;
            """,
        ),
    ]
