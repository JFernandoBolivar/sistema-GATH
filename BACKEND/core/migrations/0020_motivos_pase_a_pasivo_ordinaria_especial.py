"""
FIX-PAS1 (2026-11-08): Catálogo de jubilación y pensión en categoría «PASE A PASIVO».

Asegura que la categoría «PASE A PASIVO» en `RAC_categoria_movimiento` contenga los
motivos requeridos:
- JUBILACION ESPECIAL
- JUBILACION ORDINARIA
- PENSION DE INVALIDEZ
- PENSION POR SOBREVIVIENTE

Idempotente y no destructivo.
"""
from django.db import migrations

CAT = '"RAC_categoria_movimiento"'
TIPO = '"Tipo_movimiento"'

MOTIVOS_A_ASEGURAR = (
    'JUBILACION ESPECIAL',
    'JUBILACION ORDINARIA',
    'PENSION DE INVALIDEZ',
    'PENSION POR SOBREVIVIENTE',
)


def _existe_tabla(cursor, nombre: str) -> bool:
    cursor.execute('SELECT to_regclass(%s)', [f'"{nombre}"'])
    return cursor.fetchone()[0] is not None


def sembrar_motivos_pase_a_pasivo(apps, schema_editor):
    conexion = schema_editor.connection
    if conexion.vendor != 'postgresql':
        return
    with conexion.cursor() as cursor:
        if not (_existe_tabla(cursor, 'RAC_categoria_movimiento') and _existe_tabla(cursor, 'Tipo_movimiento')):
            return

        cursor.execute(
            f'SELECT id FROM {CAT} WHERE UPPER(categoria) = %s ORDER BY id LIMIT 1',
            ['PASE A PASIVO'],
        )
        fila = cursor.fetchone()
        if fila:
            cat_id = fila[0]
        else:
            cursor.execute(
                f'INSERT INTO {CAT} (categoria) VALUES (%s) RETURNING id',
                ['PASE A PASIVO'],
            )
            cat_id = cursor.fetchone()[0]

        for nombre in MOTIVOS_A_ASEGURAR:
            cursor.execute(
                f'SELECT id FROM {TIPO} WHERE UPPER(movimiento) = %s AND "categoriaId" = %s',
                [nombre, cat_id],
            )
            m_row = cursor.fetchone()
            if m_row:
                cursor.execute(f'UPDATE {TIPO} SET activo = true WHERE id = %s', [m_row[0]])
            else:
                cursor.execute(
                    f'SELECT id FROM {TIPO} WHERE UPPER(movimiento) = %s ORDER BY id LIMIT 1',
                    [nombre],
                )
                m_otro = cursor.fetchone()
                if m_otro:
                    cursor.execute(
                        f'UPDATE {TIPO} SET "categoriaId" = %s, activo = true WHERE id = %s',
                        [cat_id, m_otro[0]],
                    )
                else:
                    cursor.execute(
                        f'INSERT INTO {TIPO} (movimiento, "categoriaId", activo) VALUES (%s, %s, true)',
                        [nombre, cat_id],
                    )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_sembrar_paises_iso3166'),
    ]

    operations = [
        migrations.RunPython(sembrar_motivos_pase_a_pasivo, reverse_code=migrations.RunPython.noop),
    ]
