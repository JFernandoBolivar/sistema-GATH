"""
O43: nombre visible del rol, con el código interno (`nombre_rol`) intacto.

`USER_rol` es legada (`managed = False`), así que el estado de Django se
actualiza con `state_operations` y la columna se crea con DDL idempotente
(`ADD COLUMN IF NOT EXISTS`), protegido si la tabla no existe. Los 10 nombres
se llenan solo donde la columna está vacía. No se revierte: quitar la columna
destruiría nombres editados.
"""
from django.db import migrations, models

from apps.identidad.infrastructure.schema.nombres_visibles_roles import (
    SQL_AGREGAR_COLUMNA,
    aplicar_nombres_visibles,
)


def _aplicar(apps, schema_editor):
    aplicar_nombres_visibles(schema_editor.connection)


class Migration(migrations.Migration):
    dependencies = [
        ('identidad', '0010_seed_permisos_final'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='rolmodel',
                    name='nombre_visible',
                    field=models.CharField(blank=True, max_length=100, null=True),
                ),
            ],
            database_operations=[
                migrations.RunSQL(SQL_AGREGAR_COLUMNA, migrations.RunSQL.noop),
            ],
        ),
        migrations.RunPython(_aplicar, migrations.RunPython.noop),
    ]
