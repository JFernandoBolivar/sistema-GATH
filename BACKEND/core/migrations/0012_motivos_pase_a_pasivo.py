"""
D13 (2026-11-04): motivos de «PASE A PASIVO» sin duplicados en INGRESO.

La migración 0010 sembró en INGRESO copias de JUBILACION DE DERECHO,
PENSION DE INVALIDEZ y PENSION POR SOBREVIVIENTE, aunque los originales viven
en EGRESO y ahora la operación `pase_a_pasivo` usa la categoría «PASE A PASIVO».

Esta migración, idempotente y solo PostgreSQL:
1. Mueve a «PASE A PASIVO» (conservando el id) los motivos con esos nombres que
   estén en EGRESO. Los demás motivos de EGRESO no se tocan.
2. Para cada copia del mismo nombre en INGRESO: reasigna dinámicamente TODAS las
   FK que apuntan a "Tipo_movimiento"(id) hacia el id original y después borra
   la copia. Las FK se descubren en pg_constraint, no se codifican a mano.
3. Si no existe el original en EGRESO, mueve el de INGRESO a PASE A PASIVO en
   lugar de borrarlo.
4. Si no hay ninguna fila con ese nombre, no crea nada.

No se revierte: la reasignación de FK y el borrado de duplicados son
irreversibles sin una copia de la base.
"""
from django.db import migrations

CAT = '"RAC_categoria_movimiento"'
TIPO = '"Tipo_movimiento"'

NOMBRES = (
    'JUBILACION DE DERECHO',
    'PENSION DE INVALIDEZ',
    'PENSION POR SOBREVIVIENTE',
)


def _existe_tabla(cursor, nombre: str) -> bool:
    cursor.execute('SELECT to_regclass(%s)', [f'"{nombre}"'])
    return cursor.fetchone()[0] is not None


def _id_categoria(cursor, nombre: str) -> int:
    cursor.execute(
        f'SELECT id FROM {CAT} WHERE UPPER(categoria) = UPPER(%s) ORDER BY id LIMIT 1',
        [nombre],
    )
    fila = cursor.fetchone()
    if fila:
        return fila[0]
    cursor.execute(f'INSERT INTO {CAT} (categoria) VALUES (%s) RETURNING id', [nombre])
    return cursor.fetchone()[0]


def _ids_categoria(cursor, nombre: str) -> list[int]:
    cursor.execute(
        f'SELECT id FROM {CAT} WHERE UPPER(categoria) = UPPER(%s) ORDER BY id',
        [nombre],
    )
    return [fila[0] for fila in cursor.fetchall()]


def _reasignar_fk(cursor, anterior: int, nuevo: int) -> None:
    """Lleva a `nuevo` todas las columnas FK que apunten a Tipo_movimiento(id)=`anterior`."""
    cursor.execute(
        """
        SELECT con.conrelid::regclass::text, att.attname
        FROM pg_constraint con
        JOIN pg_attribute ref
          ON ref.attrelid = con.confrelid
         AND ref.attname = 'id'
         AND ref.attnum = ANY(con.confkey)
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid
         AND att.attnum = con.conkey[array_position(con.confkey, ref.attnum)]
        WHERE con.contype = 'f'
          AND con.confrelid = 'public."Tipo_movimiento"'::regclass
        """
    )
    for tabla, columna in cursor.fetchall():
        cursor.execute(
            f'UPDATE {tabla} SET "{columna}" = %s WHERE "{columna}" = %s',
            [nuevo, anterior],
        )


def ajustar(apps, schema_editor):
    conexion = schema_editor.connection
    if conexion.vendor != 'postgresql':
        return
    with conexion.cursor() as cursor:
        if not (_existe_tabla(cursor, 'RAC_categoria_movimiento') and _existe_tabla(cursor, 'Tipo_movimiento')):
            return

        pase = _id_categoria(cursor, 'PASE A PASIVO')
        egreso_ids = _ids_categoria(cursor, 'EGRESO')
        ingreso_ids = _ids_categoria(cursor, 'INGRESO')

        for nombre in NOMBRES:
            # 1) Originales en EGRESO: pasar todos a PASE A PASIVO sin cambiar id.
            originales: list[int] = []
            if egreso_ids:
                cursor.execute(
                    f'SELECT id FROM {TIPO} WHERE UPPER(movimiento) = %s '
                    f'AND "categoriaId" = ANY(%s::int[]) ORDER BY id',
                    [nombre, egreso_ids],
                )
                originales = [fila[0] for fila in cursor.fetchall()]
                if originales:
                    cursor.execute(
                        f'UPDATE {TIPO} SET "categoriaId" = %s WHERE id = ANY(%s::int[])',
                        [pase, originales],
                    )

            # 2) Sin original en EGRESO: el primero de INGRESO se mueve (conserva id).
            if not originales and ingreso_ids:
                cursor.execute(
                    f'SELECT id FROM {TIPO} WHERE UPPER(movimiento) = %s '
                    f'AND "categoriaId" = ANY(%s::int[]) ORDER BY id',
                    [nombre, ingreso_ids],
                )
                candidatos = [fila[0] for fila in cursor.fetchall()]
                if candidatos:
                    originales = [candidatos[0]]
                    cursor.execute(
                        f'UPDATE {TIPO} SET "categoriaId" = %s WHERE id = %s',
                        [pase, originales[0]],
                    )

            if not originales:
                continue

            canonico = originales[0]

            # 3) Copias en INGRESO: reasignar referencias y borrar.
            if ingreso_ids:
                cursor.execute(
                    f'SELECT id FROM {TIPO} WHERE UPPER(movimiento) = %s '
                    f'AND "categoriaId" = ANY(%s::int[]) AND id <> %s',
                    [nombre, ingreso_ids, canonico],
                )
                for (duplicado,) in cursor.fetchall():
                    _reasignar_fk(cursor, duplicado, canonico)
                    cursor.execute(f'DELETE FROM {TIPO} WHERE id = %s', [duplicado])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_reparar_secuencias_legado'),
    ]

    operations = [
        migrations.RunPython(ajustar, migrations.RunPython.noop),
    ]
