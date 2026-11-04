"""
Repara los contadores de id (secuencias) atrasados de las tablas del legado.

Hallazgo QA 2026-11-04: `RAC_categorias_alergias_id_seq` iba en 2 con filas
hasta el id 6, así que crear una categoría nueva chocaba con un id existente y
el sistema respondía «ya existe». Las tablas cargadas a mano o migradas del
sistema anterior pueden tener el mismo problema.

Para cada columna con secuencia propia en el esquema público, si el valor de la
secuencia es menor que el id máximo, la adelanta a ese máximo. Solo avanza
(nunca retrocede), no toca datos y es idempotente: se puede correr en QA y en
producción sin riesgo. No se revierte.
"""
from django.db import migrations

SQL = r"""
DO $$
DECLARE
    r record;
    maximo bigint;
    actual bigint;
BEGIN
    FOR r IN
        SELECT c.table_schema, c.table_name, c.column_name,
               pg_get_serial_sequence(format('%I.%I', c.table_schema, c.table_name), c.column_name) AS secuencia
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = 'public'
          AND pg_get_serial_sequence(format('%I.%I', c.table_schema, c.table_name), c.column_name) IS NOT NULL
    LOOP
        EXECUTE format('SELECT max(%I) FROM %I.%I', r.column_name, r.table_schema, r.table_name) INTO maximo;
        IF maximo IS NULL THEN
            CONTINUE;
        END IF;
        EXECUTE format('SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END FROM %s', r.secuencia) INTO actual;
        IF actual < maximo THEN
            PERFORM setval(r.secuencia, maximo, true);
            RAISE NOTICE 'Secuencia % adelantada de % a %', r.secuencia, actual, maximo;
        END IF;
    END LOOP;
END $$;
"""


def reparar(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(SQL)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_categorias_motivo_movimiento'),
    ]

    operations = [
        migrations.RunPython(reparar, migrations.RunPython.noop),
    ]
