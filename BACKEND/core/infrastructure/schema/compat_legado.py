"""
Compatibilidad idempotente con el esquema legado (`managed = False`).

Las tablas heredadas (`Employee`, `USER_cuenta`, `Nacionalidad`) no las crea
Django: existen desde antes y el ORM solo las lee/escribe. Cuando un modelo
nuevo agrega una columna o una tabla de catálogo, la migración normal no la
crea. Este módulo concentra el DDL mínimo que sí debe ejecutarse en cualquier
entorno, con instrucciones idempotentes para que pueda correr varias veces sin
efectos secundarios.

`core.0008_compat_esquema_legado` lo ejecuta dentro de `manage.py migrate`.
"""
from django.db import connection as conexion_por_defecto

SQL_NACIONALIDAD = """
CREATE TABLE IF NOT EXISTS "Nacionalidad" (
    id serial PRIMARY KEY,
    codigo varchar(2) NOT NULL UNIQUE,
    nombre varchar(50) NOT NULL UNIQUE
)
"""

SQL_SEED_V = """
INSERT INTO "Nacionalidad" (codigo, nombre)
VALUES ('V', 'VENEZOLANO')
ON CONFLICT (codigo) DO NOTHING
"""

SQL_SEED_E = """
INSERT INTO "Nacionalidad" (codigo, nombre)
VALUES ('E', 'EXTRANJERO')
ON CONFLICT (codigo) DO NOTHING
"""

SQL_EMPLOYEE_NACIONALIDAD = """
ALTER TABLE "Employee"
    ADD COLUMN IF NOT EXISTS "nacionalidadId" integer NOT NULL DEFAULT 1
"""

SQL_PASSWORD_LARGA = """
ALTER TABLE "USER_cuenta"
    ALTER COLUMN password TYPE varchar(255)
"""

# Tablas legadas que deben existir para que el ALTER tenga sentido.
TABLAS_REQUERIDAS = ("Employee", "USER_cuenta")


def _existe_tabla(connection, tabla: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute("SELECT to_regclass(%s)", [f'"{tabla}"'])
        return cursor.fetchone()[0] is not None


def aplicar_compatibilidad(connection=None) -> None:
    """Aplica el DDL de compatibilidad de forma idempotente.

    - `Nacionalidad` se crea siempre (es un catálogo nuevo).
    - Los `ALTER TABLE` solo se ejecutan si la tabla legada existe; en una base
      recién creada no hay nada que ajustar y no debe fallar.
    """
    connection = connection or conexion_por_defecto

    with connection.cursor() as cursor:
        cursor.execute(SQL_NACIONALIDAD)
        cursor.execute(SQL_SEED_V)
        cursor.execute(SQL_SEED_E)
        if _existe_tabla(connection, "Employee"):
            cursor.execute(SQL_EMPLOYEE_NACIONALIDAD)
        if _existe_tabla(connection, "USER_cuenta"):
            cursor.execute(SQL_PASSWORD_LARGA)
