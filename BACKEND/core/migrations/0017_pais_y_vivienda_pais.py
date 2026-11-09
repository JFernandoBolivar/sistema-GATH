"""O40: catálogo de países y país/ciudad en los datos de vivienda.

Aditiva: crea `Pais`, siembra Venezuela como país por defecto, agrega
`pais_id` y `ciudad_region` a `datos_vivienda`, marca los existentes como
Venezuela y permite nulos en las referencias geográficas venezolanas para los
pasivos que residen fuera del país.
"""
from django.db import migrations

SQL_UP = """
CREATE TABLE IF NOT EXISTS "Pais" (
    "id" serial PRIMARY KEY,
    "nombre" varchar(100) NOT NULL UNIQUE,
    "codigo" varchar(3) NOT NULL UNIQUE,
    "es_venezuela" boolean NOT NULL DEFAULT false
);

INSERT INTO "Pais" ("nombre", "codigo", "es_venezuela")
VALUES ('Venezuela', 'VE', true)
ON CONFLICT ("codigo") DO NOTHING;

ALTER TABLE IF EXISTS "datos_vivienda"
    ADD COLUMN IF NOT EXISTS "pais_id" integer NULL
    REFERENCES "Pais" ("id") ON DELETE SET NULL;

ALTER TABLE IF EXISTS "datos_vivienda"
    ADD COLUMN IF NOT EXISTS "ciudad_region" varchar(120) NULL;

UPDATE "datos_vivienda"
SET "pais_id" = (SELECT "id" FROM "Pais" WHERE "codigo" = 'VE')
WHERE "pais_id" IS NULL;

ALTER TABLE IF EXISTS "datos_vivienda" ALTER COLUMN "estadoId" DROP NOT NULL;
ALTER TABLE IF EXISTS "datos_vivienda" ALTER COLUMN "municipioId" DROP NOT NULL;
ALTER TABLE IF EXISTS "datos_vivienda" ALTER COLUMN "parroquiaId" DROP NOT NULL;
ALTER TABLE IF EXISTS "datos_vivienda" ALTER COLUMN "codigo_postal_id" DROP NOT NULL;
"""

SQL_DOWN = """
ALTER TABLE IF EXISTS "datos_vivienda" DROP COLUMN IF EXISTS "ciudad_region";
ALTER TABLE IF EXISTS "datos_vivienda" DROP COLUMN IF EXISTS "pais_id";
DROP TABLE IF EXISTS "Pais";
"""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_orden_hijo_familiar'),
    ]

    operations = [
        migrations.RunSQL(SQL_UP, SQL_DOWN),
    ]
