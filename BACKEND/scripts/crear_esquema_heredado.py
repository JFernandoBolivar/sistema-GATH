"""
H-7: crea el esquema mínimo de las tablas heredadas (modelos ``managed=False``) en una
base VACÍA, para poder correr ``manage.py migrate`` desde cero (CI / verificación).

No existe en el repo un SQL del esquema heredado (la base real viene de un respaldo de
producción), así que se deriva de los propios modelos: se crean con ``schema_editor``
las tablas de todo modelo no gestionado (omitiendo los modelos «Espejo», vistas parciales
de otra tabla, y deduplicando por ``db_table``, igual que ``tests/conftest.py``).
Las restricciones de clave foránea se aplican una a una y las que apuntan a tablas que
aún no existen (las crean las migraciones) se omiten: es un esquema de prueba, no una
réplica de producción.

Uso (solo contra una base desechable):
    python scripts/crear_esquema_heredado.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'GATH.settings')

import django  # noqa: E402

django.setup()

from django.apps import apps  # noqa: E402
from django.db import connection  # noqa: E402


def main() -> int:
    vistas = {m._meta.db_table for m in apps.get_models() if m._meta.managed}
    modelos = []
    for m in sorted(apps.get_models(), key=lambda x: (1 if 'Espejo' in x.__name__ else 0, x.__name__)):
        if m._meta.managed or 'Espejo' in m.__name__ or m._meta.db_table in vistas:
            continue
        vistas.add(m._meta.db_table)
        modelos.append(m)

    omitidas = []
    with connection.schema_editor(atomic=False) as editor:
        for m in modelos:
            editor.create_model(m)
        pendientes = list(editor.deferred_sql)
        editor.deferred_sql.clear()
        # La base real tiene DEFAULT en columnas NOT NULL que el modelo solo declara en
        # Python (p. ej. Tipo_movimiento.activo); algunas migraciones insertan sin ellas.
        for m in modelos:
            for campo in m._meta.local_concrete_fields:
                if (campo.has_default() and not callable(campo.default) and not campo.null
                        and not campo.primary_key):
                    valor = editor.quote_value(editor.effective_default(campo))
                    pendientes.append(
                        f'ALTER TABLE {editor.quote_name(m._meta.db_table)} '
                        f'ALTER COLUMN {editor.quote_name(campo.column)} SET DEFAULT {valor}'
                    )
    for sql in pendientes:
        try:
            with connection.cursor() as cursor:
                cursor.execute(str(sql))
        except Exception as exc:  # FK a una tabla que aún no existe
            omitidas.append(str(exc).splitlines()[0])
    print(f'Tablas heredadas creadas: {len(modelos)}; sentencias diferidas omitidas: {len(omitidas)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
