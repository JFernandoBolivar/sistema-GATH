# Generated for GATH - Performance Optimization & Index Audit
from django.db import migrations

FORWARD_SQL = """
DO $$
BEGIN
    -- 1. Personal y Expediente
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Employee') THEN
        CREATE INDEX IF NOT EXISTS idx_employee_fecha_act ON "Employee" ("fecha_actualizacion" DESC);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'antecedentes_servicio') THEN
        CREATE INDEX IF NOT EXISTS idx_antecedentes_empleado ON "antecedentes_servicio" ("empleadoId");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contratos') THEN
        CREATE INDEX IF NOT EXISTS idx_contratos_antecedente ON "contratos" ("antecedente_id_id");
        CREATE INDEX IF NOT EXISTS idx_contratos_fecha_culm ON "contratos" ("fecha_culminacion");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'datos_vivienda') THEN
        CREATE INDEX IF NOT EXISTS idx_vivienda_empleado ON "datos_vivienda" ("empleadoId");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'perfil_salud') THEN
        CREATE INDEX IF NOT EXISTS idx_salud_empleado ON "perfil_salud" ("empleadoId");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'perfil_fisico') THEN
        CREATE INDEX IF NOT EXISTS idx_fisico_empleado ON "perfil_fisico" ("empleadoId");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'formacion_academica') THEN
        CREATE INDEX IF NOT EXISTS idx_academica_empleado ON "formacion_academica" ("empleadoId");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'formacion_complementaria') THEN
        CREATE INDEX IF NOT EXISTS idx_complementaria_empleado ON "formacion_complementaria" ("empleadoId");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contactos_emergencia') THEN
        CREATE INDEX IF NOT EXISTS idx_emergencia_empleado ON "contactos_emergencia" ("empleadoId");
    END IF;

    -- 2. Cargos y Asignaciones
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AsigTrabajo') THEN
        CREATE INDEX IF NOT EXISTS idx_asigtrabajo_codigo ON "AsigTrabajo" ("codigo");
        CREATE INDEX IF NOT EXISTS idx_asigtrabajo_empleado ON "AsigTrabajo" ("employeeCedula");
        CREATE INDEX IF NOT EXISTS idx_asigtrabajo_estatus ON "AsigTrabajo" ("estatusId");
        CREATE INDEX IF NOT EXISTS idx_asigtrabajo_dependencia ON "AsigTrabajo" ("dependenciaId");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PrestamoCargo') THEN
        CREATE INDEX IF NOT EXISTS idx_prestamo_empleado ON "PrestamoCargo" ("empleadoEncargadoCedula");
        CREATE INDEX IF NOT EXISTS idx_prestamo_cargo ON "PrestamoCargo" ("cargoEncargadoId");
    END IF;

    -- 3. Movimientos e Historial
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'EmployeeMovementHistory') THEN
        CREATE INDEX IF NOT EXISTS idx_movimiento_empleado ON "EmployeeMovementHistory" ("empleado_id");
        CREATE INDEX IF NOT EXISTS idx_movimiento_codigo_puesto ON "EmployeeMovementHistory" ("codigo_puesto");
        CREATE INDEX IF NOT EXISTS idx_movimiento_fecha ON "EmployeeMovementHistory" ("fecha_movimiento" DESC);
        CREATE INDEX IF NOT EXISTS idx_movimiento_emp_fecha ON "EmployeeMovementHistory" ("empleado_id", "fecha_movimiento" DESC);
    END IF;

    -- 4. Familiares
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RAC_employeefamily') THEN
        CREATE INDEX IF NOT EXISTS idx_familiar_empleado ON "RAC_employeefamily" ("employeeCedula");
        CREATE INDEX IF NOT EXISTS idx_familiar_cedula ON "RAC_employeefamily" ("cedulaFamiliar");
    END IF;

    -- 5. Pasivos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'EmployeeEgresado') THEN
        CREATE INDEX IF NOT EXISTS idx_egresado_empleado ON "EmployeeEgresado" ("employeeCedula");
        CREATE INDEX IF NOT EXISTS idx_egresado_fecha ON "EmployeeEgresado" ("fecha_egreso" DESC);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CargoEgresado') THEN
        CREATE INDEX IF NOT EXISTS idx_cargo_egresado_egreso ON "CargoEgresado" ("egreso_id");
    END IF;

    -- 6. Jerarquía Organizacional
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DireccionGeneral') THEN
        CREATE INDEX IF NOT EXISTS idx_dir_general_dep ON "DireccionGeneral" ("dependenciaId");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DireccionLinea') THEN
        CREATE INDEX IF NOT EXISTS idx_dir_linea_dg ON "DireccionLinea" ("direccionGeneralId");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Coordinacion') THEN
        CREATE INDEX IF NOT EXISTS idx_coordinacion_dl ON "Coordinacion" ("direccionLineaId");
    END IF;

    -- 7. Autogestión
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RespuestasEncuesta') THEN
        CREATE INDEX IF NOT EXISTS idx_respuestas_empleado ON "RespuestasEncuesta" ("empleado_cedula");
    END IF;
END $$;
"""

REVERSE_SQL = """
DROP INDEX IF EXISTS idx_employee_fecha_act;
DROP INDEX IF EXISTS idx_antecedentes_empleado;
DROP INDEX IF EXISTS idx_contratos_antecedente;
DROP INDEX IF EXISTS idx_contratos_fecha_culm;
DROP INDEX IF EXISTS idx_vivienda_empleado;
DROP INDEX IF EXISTS idx_salud_empleado;
DROP INDEX IF EXISTS idx_fisico_empleado;
DROP INDEX IF EXISTS idx_academica_empleado;
DROP INDEX IF EXISTS idx_complementaria_empleado;
DROP INDEX IF EXISTS idx_emergencia_empleado;
DROP INDEX IF EXISTS idx_asigtrabajo_codigo;
DROP INDEX IF EXISTS idx_asigtrabajo_empleado;
DROP INDEX IF EXISTS idx_asigtrabajo_estatus;
DROP INDEX IF EXISTS idx_asigtrabajo_dependencia;
DROP INDEX IF EXISTS idx_prestamo_empleado;
DROP INDEX IF EXISTS idx_prestamo_cargo;
DROP INDEX IF EXISTS idx_movimiento_empleado;
DROP INDEX IF EXISTS idx_movimiento_codigo_puesto;
DROP INDEX IF EXISTS idx_movimiento_fecha;
DROP INDEX IF EXISTS idx_movimiento_emp_fecha;
DROP INDEX IF EXISTS idx_familiar_empleado;
DROP INDEX IF EXISTS idx_familiar_cedula;
DROP INDEX IF EXISTS idx_egresado_empleado;
DROP INDEX IF EXISTS idx_egresado_fecha;
DROP INDEX IF EXISTS idx_cargo_egresado_egreso;
DROP INDEX IF EXISTS idx_dir_general_dep;
DROP INDEX IF EXISTS idx_dir_linea_dg;
DROP INDEX IF EXISTS idx_coordinacion_dl;
DROP INDEX IF EXISTS idx_respuestas_empleado;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=FORWARD_SQL,
            reverse_sql=REVERSE_SQL,
        ),
    ]
