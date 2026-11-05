"""
Categorías de motivo de movimiento (datos, sin cambiar el esquema).

`RAC_categoria_movimiento` y `Tipo_movimiento` son tablas legadas (managed=False):
esta migración solo siembra datos, de forma idempotente, con SQL plano. Si las
tablas no existen (base vacía de pruebas) no hace nada.

Qué hace:
1. Crea las categorías que faltan (comparación sin distinguir mayúsculas):
   «EGRESO PASIVO» (egreso de personal pasivo) y «PASE A PASIVO».
   Nombres de máximo 20 caracteres, como la columna.
2. Reasigna motivos que hoy se reconocían por texto, SOLO si no tienen categoría
   o si están en la categoría legada «FALLECIMIENTO» (que es la misma idea que
   «EGRESO PASIVO»):
   - nombre con «FALLEC»                      -> EGRESO PASIVO
   - nombre con «JUBIL» o «PENSION» (salvo «PENSION POR SOBREV») -> PASE A PASIVO
   - nombre con «PENSION POR SOBREV»          -> INGRESO
   Los motivos que ya tienen otra categoría (p. ej. un «FALLECIMIENTO» dentro de
   EGRESO, que sirve al egreso de activos) NO se tocan.
3. Si «EGRESO PASIVO» queda sin ningún motivo, crea «FALLECIMIENTO» para
   que la pantalla de egreso de pasivos no quede vacía.
4. Garantiza (en PASE A PASIVO) los motivos que el sistema asigna solo al dar
   de alta un pasivo: JUBILACION DE DERECHO, PENSION DE INVALIDEZ,
   PENSION POR SOBREVIVIENTE. D13: no se crean copias en INGRESO.

No se revierte: no hay forma segura de distinguir lo sembrado de lo creado luego.
"""
from django.db import migrations

CAT = '"RAC_categoria_movimiento"'
TIPO = '"Tipo_movimiento"'


def _existe_tabla(cursor, nombre: str) -> bool:
    cursor.execute('SELECT to_regclass(%s)', [f'"{nombre}"'])
    return cursor.fetchone()[0] is not None


def _id_categoria(cursor, nombre: str) -> int:
    cursor.execute(f'SELECT id FROM {CAT} WHERE UPPER(categoria) = UPPER(%s) ORDER BY id LIMIT 1', [nombre])
    fila = cursor.fetchone()
    if fila:
        return fila[0]
    cursor.execute(f'INSERT INTO {CAT} (categoria) VALUES (%s) RETURNING id', [nombre])
    return cursor.fetchone()[0]


def sembrar(apps, schema_editor):
    conexion = schema_editor.connection
    if conexion.vendor != 'postgresql':
        return
    with conexion.cursor() as c:
        if not (_existe_tabla(c, 'RAC_categoria_movimiento') and _existe_tabla(c, 'Tipo_movimiento')):
            return
        egreso_pasivo = _id_categoria(c, 'EGRESO PASIVO')
        pase = _id_categoria(c, 'PASE A PASIVO')
        c.execute(f'SELECT id FROM {CAT} WHERE UPPER(categoria) = %s', ['FALLECIMIENTO'])
        fallecimiento = [f[0] for f in c.fetchall()]

        reasignables = '("categoriaId" IS NULL OR "categoriaId" = ANY(%s::int[]))'
        c.execute(
            f"UPDATE {TIPO} SET \"categoriaId\" = %s WHERE UPPER(movimiento) LIKE '%%FALLEC%%' AND {reasignables}",
            [egreso_pasivo, fallecimiento],
        )
        c.execute(
            f"UPDATE {TIPO} SET \"categoriaId\" = %s WHERE UPPER(movimiento) LIKE '%%PENSION POR SOBREV%%' AND {reasignables}",
            [pase, fallecimiento],
        )
        c.execute(
            f"UPDATE {TIPO} SET \"categoriaId\" = %s WHERE (UPPER(movimiento) LIKE '%%JUBIL%%' "
            f"OR UPPER(movimiento) LIKE '%%PENSION%%') AND UPPER(movimiento) NOT LIKE '%%PENSION POR SOBREV%%' "
            f"AND {reasignables}",
            [pase, fallecimiento],
        )

        c.execute(f'SELECT 1 FROM {TIPO} WHERE "categoriaId" = %s LIMIT 1', [egreso_pasivo])
        if c.fetchone() is None:
            c.execute(
                f'INSERT INTO {TIPO} (movimiento, "categoriaId") VALUES (%s, %s)',
                ['FALLECIMIENTO', egreso_pasivo],
            )

        for nombre in ('JUBILACION DE DERECHO', 'PENSION DE INVALIDEZ', 'PENSION POR SOBREVIVIENTE'):
            c.execute(
                f'SELECT 1 FROM {TIPO} WHERE UPPER(movimiento) = %s AND "categoriaId" = %s LIMIT 1',
                [nombre, pase],
            )
            if c.fetchone() is None:
                c.execute(f'INSERT INTO {TIPO} (movimiento, "categoriaId") VALUES (%s, %s)', [nombre, pase])


class Migration(migrations.Migration):
    dependencies = [('core', '0009_serial_carnet_patria')]

    operations = [migrations.RunPython(sembrar, migrations.RunPython.noop)]
