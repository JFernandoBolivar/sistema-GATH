"""
O9: elimina índices manuales `idx_*` duplicados exactos de un índice de FK.

Cada índice de esta lista tiene un gemelo con las mismas columnas, mismo orden
y mismo opclass, que es el índice automático de la FK (PK/UNIQUE/constraints no
se tocan). Se conserva el índice de FK y se elimina el manual redundante.

Ejecutar con `migrate core`. Reversible: el reverso recrea los `idx_*` con su
definición original.
"""
from django.db import migrations

DUPLICADOS = [
    ('idx_asigtrabajo_dependencia', 'CREATE INDEX idx_asigtrabajo_dependencia ON public."AsigTrabajo" USING btree ("dependenciaId")'),
    ('idx_asigtrabajo_empleado', 'CREATE INDEX idx_asigtrabajo_empleado ON public."AsigTrabajo" USING btree ("employeeCedula")'),
    ('idx_asigtrabajo_estatus', 'CREATE INDEX idx_asigtrabajo_estatus ON public."AsigTrabajo" USING btree ("estatusId")'),
    ('idx_cargo_egresado_egreso', 'CREATE INDEX idx_cargo_egresado_egreso ON public."CargoEgresado" USING btree (egreso_id)'),
    ('idx_dir_general_dep', 'CREATE INDEX idx_dir_general_dep ON public."DireccionGeneral" USING btree ("dependenciaId")'),
    ('idx_dir_linea_dg', 'CREATE INDEX idx_dir_linea_dg ON public."DireccionLinea" USING btree ("direccionGeneralId")'),
    ('idx_egresado_empleado', 'CREATE INDEX idx_egresado_empleado ON public."EmployeeEgresado" USING btree ("employeeCedula")'),
    ('idx_movimiento_empleado', 'CREATE INDEX idx_movimiento_empleado ON public."EmployeeMovementHistory" USING btree (empleado_id)'),
    ('idx_prestamo_cargo', 'CREATE INDEX idx_prestamo_cargo ON public."PrestamoCargo" USING btree ("cargoEncargadoId")'),
    ('idx_prestamo_empleado', 'CREATE INDEX idx_prestamo_empleado ON public."PrestamoCargo" USING btree ("empleadoEncargadoCedula")'),
    ('idx_familiar_empleado', 'CREATE INDEX idx_familiar_empleado ON public."RAC_employeefamily" USING btree ("employeeCedula")'),
    ('idx_respuestas_empleado', 'CREATE INDEX idx_respuestas_empleado ON public."RespuestasEncuesta" USING btree (empleado_cedula)'),
    ('idx_antecedentes_empleado', 'CREATE INDEX idx_antecedentes_empleado ON public.antecedentes_servicio USING btree ("empleadoId")'),
    ('idx_contratos_antecedente', 'CREATE INDEX idx_contratos_antecedente ON public.contratos USING btree (antecedente_id_id)'),
    ('idx_vivienda_empleado', 'CREATE INDEX idx_vivienda_empleado ON public.datos_vivienda USING btree ("empleadoId")'),
    ('idx_academica_empleado', 'CREATE INDEX idx_academica_empleado ON public.formacion_academica USING btree ("empleadoId")'),
    ('idx_complementaria_empleado', 'CREATE INDEX idx_complementaria_empleado ON public.formacion_complementaria USING btree ("empleadoId")'),
    ('idx_fisico_empleado', 'CREATE INDEX idx_fisico_empleado ON public.perfil_fisico USING btree ("empleadoId")'),
    ('idx_salud_empleado', 'CREATE INDEX idx_salud_empleado ON public.perfil_salud USING btree ("empleadoId")'),
]


def _drop_sql():
    return '\n'.join(f'DROP INDEX IF EXISTS "{nombre}";' for nombre, _ in DUPLICADOS)


def _create_sql():
    return '\n'.join(f'{definicion};' for _, definicion in DUPLICADOS)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_parentesco_aplica_familiar'),
    ]

    operations = [
        migrations.RunSQL(
            sql=_drop_sql(),
            reverse_sql=_create_sql(),
        ),
    ]
