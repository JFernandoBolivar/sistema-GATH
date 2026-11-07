"""
Nombre visible de los roles (O43): DDL y datos idempotentes sobre `USER_rol`.

`USER_rol` es una tabla legada (`managed = False`): Django no la crea ni la
altera, así que la columna nueva `nombre_visible` se agrega aquí con
`ADD COLUMN IF NOT EXISTS`, solo si la tabla existe. `nombre_rol` sigue siendo
el código interno (token, matriz, seed) y no se toca.

Lo comparten la migración `identidad.0011` y `seed_permisos`, de modo que una
base heredada, una recién migrada y una base nueva terminan con los mismos
nombres sin pisar los que un administrador ya haya editado.
"""
SQL_AGREGAR_COLUMNA = """
DO $$
BEGIN
    IF to_regclass('"USER_rol"') IS NOT NULL THEN
        ALTER TABLE "USER_rol"
            ADD COLUMN IF NOT EXISTS "nombre_visible" varchar(100) NULL;
    END IF;
END $$;
"""

# Código normalizado (ver `normalizar_codigo_legado`) -> nombre visible.
NOMBRES_VISIBLES_ROLES: dict[str, str] = {
    'ADMINISTRADOR': 'Administrador',
    'ANALISTA': 'Analista',
    'AUTOGESTION': 'Autogestión',
    'PRESUPUESTO': 'Presupuesto',
    'BIENESTAR SOCIAL': 'Bienestar Social',
    'ANALISTA_BIENESTAR': 'Analista de Bienestar',
    'ADMIN_BIENESTAR': 'Administrador de Bienestar',
    'AUDITOR': 'Auditor',
    'JEFE_RRHH': 'Jefe de RRHH',
    'RECEPCIONISTA': 'Recepcionista',
}


def normalizar_codigo_legado(codigo: str) -> str:
    """Unifica la errata histórica «BIENSTAR» y los espacios del código."""
    return ' '.join(str(codigo or '').strip().upper().replace('BIENSTAR', 'BIENESTAR').split())


def _existe_columna(cursor) -> bool:
    cursor.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'USER_rol' AND column_name = 'nombre_visible' "
        "AND table_schema = current_schema()"
    )
    return cursor.fetchone() is not None


def aplicar_nombres_visibles(connection) -> int:
    """Agrega la columna y llena los nombres que falten. Idempotente.

    Solo escribe donde `nombre_visible` es NULL o vacío: un nombre ya editado
    por el administrador no se pisa. Devuelve cuántos roles se llenaron.
    """
    llenados = 0
    with connection.cursor() as cursor:
        cursor.execute(SQL_AGREGAR_COLUMNA)
        if not _existe_columna(cursor):
            return 0
        cursor.execute('SELECT id, nombre_rol FROM "USER_rol" '
                       "WHERE nombre_visible IS NULL OR btrim(nombre_visible) = ''")
        for rol_id, codigo in cursor.fetchall():
            visible = NOMBRES_VISIBLES_ROLES.get(normalizar_codigo_legado(codigo))
            if visible is None:
                continue
            cursor.execute(
                'UPDATE "USER_rol" SET nombre_visible = %s WHERE id = %s',
                [visible, rol_id],
            )
            llenados += 1
    return llenados
