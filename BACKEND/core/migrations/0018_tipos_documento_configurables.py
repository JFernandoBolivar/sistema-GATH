"""O41: catálogo configurable de tipos de soporte y checklist por sección.

Aditiva e idempotente. Crea el catálogo de tipos de documento con sus marcas de
reservado/protegido y el checklist sección -> tipo (permitido/exigido).

Siembra EXACTAMENTE los valores históricos de
`TIPOS_SOPORTE_POR_SECCION` (autogestion) para que nada cambie visiblemente:
mismos códigos, mismos nombres, mismas secciones. Los seis tipos actuales son
reservados porque las reglas del sistema los usan y protegidos porque una regla
exige al menos uno de ellos en alguna sección.
"""
from django.db import migrations

SQL_UP = """
CREATE TABLE IF NOT EXISTS "TipoSoporteDocumento" (
    "id" serial PRIMARY KEY,
    "codigo" varchar(40) NOT NULL UNIQUE,
    "nombre" varchar(100) NOT NULL,
    "es_reservado" boolean NOT NULL DEFAULT false,
    "es_protegido" boolean NOT NULL DEFAULT false,
    "orden" integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "ChecklistSoporteSeccion" (
    "id" serial PRIMARY KEY,
    "seccion" varchar(40) NOT NULL,
    "tipo_soporte_id" integer NOT NULL
        REFERENCES "TipoSoporteDocumento" ("id") ON DELETE CASCADE,
    "etiqueta" varchar(100) NULL,
    "permitido" boolean NOT NULL DEFAULT true,
    "requerido" boolean NOT NULL DEFAULT false,
    "orden" integer NOT NULL DEFAULT 0,
    CONSTRAINT "ChecklistSoporteSeccion_seccion_tipo_uk"
        UNIQUE ("seccion", "tipo_soporte_id")
);

INSERT INTO "TipoSoporteDocumento"
    ("codigo", "nombre", "es_reservado", "es_protegido", "orden")
VALUES
    ('TITULO', 'Título', true, true, 10),
    ('ACTA_NACIMIENTO', 'Partida de nacimiento', true, true, 20),
    ('CEDULA', 'Copia de la cédula', true, true, 30),
    ('CONSTANCIA', 'Constancia', true, true, 40),
    ('FOTO', 'Foto', true, true, 50),
    ('OTRO', 'Otro documento', true, true, 60)
ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "ChecklistSoporteSeccion"
    ("seccion", "tipo_soporte_id", "etiqueta", "permitido", "requerido", "orden")
SELECT v.seccion, t.id, v.etiqueta, v.permitido, v.requerido, v.orden
FROM (VALUES
    ('identidad', 'CEDULA', 'Copia de la cédula', true, true, 10),
    ('contacto', 'CONSTANCIA', 'Constancia', true, false, 10),
    ('contacto', 'OTRO', 'Otro documento', true, false, 20),
    ('vivienda', 'CONSTANCIA', 'Constancia de residencia', true, false, 10),
    ('vivienda', 'OTRO', 'Otro documento', true, false, 20),
    ('formacion', 'TITULO', 'Título', true, true, 10),
    ('formacion', 'CONSTANCIA', 'Constancia de estudios', true, true, 20),
    ('formacion', 'OTRO', 'Otro documento', true, false, 30),
    ('complementaria', 'CONSTANCIA', 'Certificado o constancia', true, true, 10),
    ('complementaria', 'OTRO', 'Otro documento', true, true, 20),
    ('familiar', 'CEDULA', 'Copia de la cédula', true, true, 10),
    ('familiar', 'ACTA_NACIMIENTO', 'Partida de nacimiento', true, true, 20),
    ('familiar', 'CONSTANCIA', 'Constancia', true, true, 30),
    ('familiar', 'OTRO', 'Otro documento', true, true, 40),
    ('foto', 'FOTO', 'Foto', true, true, 10),
    ('antecedentes', 'CONSTANCIA', 'Constancia de trabajo', true, true, 10),
    ('antecedentes', 'OTRO', 'Otro documento', true, true, 20)
) AS v(seccion, codigo, etiqueta, permitido, requerido, orden)
JOIN "TipoSoporteDocumento" t ON t.codigo = v.codigo
ON CONFLICT ("seccion", "tipo_soporte_id") DO NOTHING;
"""

SQL_DOWN = """
DROP TABLE IF EXISTS "ChecklistSoporteSeccion";
DROP TABLE IF EXISTS "TipoSoporteDocumento";
"""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_pais_y_vivienda_pais'),
    ]

    operations = [
        migrations.RunSQL(SQL_UP, reverse_sql=SQL_DOWN),
    ]
