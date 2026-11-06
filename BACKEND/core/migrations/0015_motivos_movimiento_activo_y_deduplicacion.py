"""
O29 (2026-11-05): columna activo en Tipo_movimiento y deduplicación de motivos.

1. Agrega la columna `activo` (boolean, default true) a "Tipo_movimiento".
2. Deduplica motivos con el mismo nombre y categoría: conserva el id canónico
   (menor id), reasigna dinámicamente todas las FKs que apunten a los duplicados
   usando pg_constraint con savepoints para prevenir colisiones de UNIQUE,
   y elimina los registros duplicados solo si no tienen referencias activas;
   si conservan referencias, se marcan como inactivos (activo = false).
3. Asegura que los motivos de sistema (JUBILACION DE DERECHO, PENSION DE INVALIDEZ,
   PENSION POR SOBREVIVIENTE) vivan únicamente en PASE A PASIVO y no queden copias
   en EGRESO ni INGRESO.
"""
import logging

from django.db import DatabaseError, IntegrityError, migrations

logger = logging.getLogger(__name__)

CAT = '"RAC_categoria_movimiento"'
TIPO = '"Tipo_movimiento"'

NOMBRES_SISTEMA = (
    'JUBILACION DE DERECHO',
    'PENSION DE INVALIDEZ',
    'PENSION POR SOBREVIVIENTE',
)


def _existe_tabla(cursor, nombre: str) -> bool:
    cursor.execute('SELECT to_regclass(%s)', [f'"{nombre}"'])
    return cursor.fetchone()[0] is not None


def _id_categoria(cursor, nombre: str) -> int | None:
    cursor.execute(
        f'SELECT id FROM {CAT} WHERE UPPER(categoria) = UPPER(%s) ORDER BY id LIMIT 1',
        [nombre],
    )
    fila = cursor.fetchone()
    return fila[0] if fila else None


def _obtener_fks_hacia_tipo_movimiento(cursor) -> list[tuple[str, str]]:
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
    return cursor.fetchall()


def _tiene_referencias(cursor, motivo_id: int, fks: list[tuple[str, str]]) -> bool:
    """Verifica sin fallar si alguna tabla FK todavía apunta al motivo_id."""
    for tabla, columna in fks:
        cursor.execute(
            f'SELECT 1 FROM {tabla} WHERE "{columna}" = %s LIMIT 1',
            [motivo_id],
        )
        if cursor.fetchone():
            return True
    return False


def _reasignar_fk(cursor, anterior: int, nuevo: int, fks: list[tuple[str, str]]) -> None:
    """Lleva a `nuevo` todas las columnas FK que apunten a Tipo_movimiento(id)=`anterior`."""
    for i, (tabla, columna) in enumerate(fks):
        sp_name = f'sp_reasig_{anterior}_{nuevo}_{i}'
        cursor.execute(f'SAVEPOINT {sp_name}')
        try:
            cursor.execute(
                f'UPDATE {tabla} SET "{columna}" = %s WHERE "{columna}" = %s',
                [nuevo, anterior],
            )
            cursor.execute(f'RELEASE SAVEPOINT {sp_name}')
        except (DatabaseError, IntegrityError) as exc:
            cursor.execute(f'ROLLBACK TO SAVEPOINT {sp_name}')
            logger.warning(
                "No se pudo reasignar FK en %s.%s de %s a %s: %s",
                tabla,
                columna,
                anterior,
                nuevo,
                exc,
            )


def ajustar(apps, schema_editor):
    conexion = schema_editor.connection
    if conexion.vendor != 'postgresql':
        return

    with conexion.cursor() as cursor:
        if not (_existe_tabla(cursor, 'RAC_categoria_movimiento') and _existe_tabla(cursor, 'Tipo_movimiento')):
            return

        # 1. Columna activo
        cursor.execute(
            'ALTER TABLE "Tipo_movimiento" ADD COLUMN IF NOT EXISTS "activo" boolean NOT NULL DEFAULT true;'
        )

        fks = _obtener_fks_hacia_tipo_movimiento(cursor)

        # 2. Asegurar que los motivos de sistema estén en PASE A PASIVO y reasignar copias en EGRESO/INGRESO
        pase_id = _id_categoria(cursor, 'PASE A PASIVO')
        if pase_id:
            for nom in NOMBRES_SISTEMA:
                cursor.execute(
                    f'SELECT id FROM {TIPO} WHERE UPPER(TRIM(movimiento)) = %s '
                    f'AND "categoriaId" = %s ORDER BY id',
                    [nom, pase_id],
                )
                filas_pase = [r[0] for r in cursor.fetchall()]
                if not filas_pase:
                    # Si no existe en pase, buscar en cualquier categoría y mover el primero
                    cursor.execute(
                        f'SELECT id FROM {TIPO} WHERE UPPER(TRIM(movimiento)) = %s ORDER BY id',
                        [nom],
                    )
                    filas_cualquiera = [r[0] for r in cursor.fetchall()]
                    if filas_cualquiera:
                        canonico = filas_cualquiera[0]
                        cursor.execute(
                            f'UPDATE {TIPO} SET "categoriaId" = %s WHERE id = %s',
                            [pase_id, canonico],
                        )
                        filas_pase = [canonico]

                if filas_pase:
                    canonico = filas_pase[0]
                    # Cualquier otra fila con el mismo nombre en OTRA categoría o duplicada en PASE A PASIVO
                    cursor.execute(
                        f'SELECT id FROM {TIPO} WHERE UPPER(TRIM(movimiento)) = %s AND id <> %s',
                        [nom, canonico],
                    )
                    for (dup_id,) in cursor.fetchall():
                        _reasignar_fk(cursor, dup_id, canonico, fks)
                        if not _tiene_referencias(cursor, dup_id, fks):
                            cursor.execute(f'DELETE FROM {TIPO} WHERE id = %s', [dup_id])
                        else:
                            cursor.execute(f'UPDATE {TIPO} SET "activo" = false WHERE id = %s', [dup_id])

        # 3. Deduplicar cualquier otro motivo repetido dentro de la misma categoría
        cursor.execute(
            f"""
            SELECT UPPER(TRIM(movimiento)), "categoriaId", COUNT(*), array_agg(id ORDER BY id)
            FROM {TIPO}
            GROUP BY UPPER(TRIM(movimiento)), "categoriaId"
            HAVING COUNT(*) > 1
            """
        )
        grupos = cursor.fetchall()
        for _, _, _, ids in grupos:
            canonico = ids[0]
            duplicados = ids[1:]
            for dup_id in duplicados:
                _reasignar_fk(cursor, dup_id, canonico, fks)
                if not _tiene_referencias(cursor, dup_id, fks):
                    cursor.execute(f'DELETE FROM {TIPO} WHERE id = %s', [dup_id])
                else:
                    cursor.execute(f'UPDATE {TIPO} SET "activo" = false WHERE id = %s', [dup_id])


def revertir(apps, schema_editor):
    conexion = schema_editor.connection
    if conexion.vendor != 'postgresql':
        return
    with conexion.cursor() as cursor:
        if _existe_tabla(cursor, 'Tipo_movimiento'):
            cursor.execute('ALTER TABLE "Tipo_movimiento" DROP COLUMN IF EXISTS "activo";')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0014_indices_duplicados'),
    ]

    operations = [
        migrations.RunPython(ajustar, revertir),
    ]
