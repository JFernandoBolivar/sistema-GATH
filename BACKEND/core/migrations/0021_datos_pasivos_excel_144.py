"""
FIX-PAS1 (2026-11-08): Migración de datos idempotente para los 144 pasivos del Excel.

Completa en PARA-PROD la fecha y tipo de jubilación de los 144 pasivos:
- Walter Landaeta (3403630): fecha 2004-03-18, tipo JUBILACION ESPECIAL.
- Odalis Ramírez (10510831): fecha 2026-07-10, tipo JUBILACION ORDINARIA.
- Resto de pasivos: tipo según Excel (especial, ordinaria, invalidez, sobreviviente).

Requisitos:
- Idempotente.
- Busca por cédula y solo completa si la persona existe y el campo está vacío (nunca sobrescribe,
  salvo Walter y Odalis para fijar sus fechas solicitadas).
- Si la persona no existe no falla (ej. cédula 17762231).
- reverse_code no destructivo (noop).
"""
from django.db import migrations

# Tuplas (cédula, tipo_jubilacion_o_pension, fecha_vigencia_fija_o_None)
PASIVOS_144 = [
    ('638954', 'JUBILACION ESPECIAL', None),
    ('642546', 'JUBILACION ESPECIAL', None),
    ('1716666', 'PENSION POR SOBREVIVIENTE', None),
    ('2154508', 'JUBILACION ORDINARIA', None),
    ('2520934', 'JUBILACION ORDINARIA', None),
    ('2639881', 'JUBILACION ESPECIAL', None),
    ('2895181', 'JUBILACION ORDINARIA', None),
    ('2953684', 'JUBILACION ORDINARIA', None),
    ('2958187', 'JUBILACION ORDINARIA', None),
    ('2981071', 'JUBILACION ORDINARIA', None),
    ('3149685', 'JUBILACION ESPECIAL', None),
    ('3149702', 'JUBILACION ORDINARIA', None),
    ('3157791', 'JUBILACION ORDINARIA', None),
    ('3235650', 'JUBILACION ORDINARIA', None),
    ('3249666', 'JUBILACION ORDINARIA', None),
    ('3403630', 'JUBILACION ESPECIAL', '2004-03-18'),
    ('3569848', 'JUBILACION ORDINARIA', None),
    ('3588997', 'JUBILACION ORDINARIA', None),
    ('3622415', 'JUBILACION ORDINARIA', None),
    ('3659164', 'JUBILACION ORDINARIA', None),
    ('3675727', 'JUBILACION ORDINARIA', None),
    ('3686713', 'JUBILACION ESPECIAL', None),
    ('3729054', 'JUBILACION ORDINARIA', None),
    ('3755408', 'JUBILACION ORDINARIA', None),
    ('3800270', 'JUBILACION ESPECIAL', None),
    ('3803507', 'JUBILACION ORDINARIA', None),
    ('3817872', 'JUBILACION ESPECIAL', None),
    ('3819296', 'JUBILACION ORDINARIA', None),
    ('3819526', 'PENSION DE INVALIDEZ', None),
    ('3821731', 'JUBILACION ORDINARIA', None),
    ('3884841', 'JUBILACION ORDINARIA', None),
    ('3890789', 'JUBILACION ESPECIAL', None),
    ('3972740', 'JUBILACION ORDINARIA', None),
    ('4002626', 'JUBILACION ORDINARIA', None),
    ('4045868', 'JUBILACION ORDINARIA', None),
    ('4089855', 'PENSION DE INVALIDEZ', None),
    ('4167198', 'JUBILACION ORDINARIA', None),
    ('4170327', 'JUBILACION ORDINARIA', None),
    ('4252575', 'JUBILACION ORDINARIA', None),
    ('4268712', 'PENSION DE INVALIDEZ', None),
    ('4349788', 'JUBILACION ORDINARIA', None),
    ('4352125', 'PENSION DE INVALIDEZ', None),
    ('4353880', 'JUBILACION ORDINARIA', None),
    ('4356071', 'JUBILACION ORDINARIA', None),
    ('4356193', 'PENSION DE INVALIDEZ', None),
    ('4356611', 'JUBILACION ORDINARIA', None),
    ('4357945', 'JUBILACION ORDINARIA', None),
    ('4425714', 'JUBILACION ORDINARIA', None),
    ('4437248', 'JUBILACION ORDINARIA', None),
    ('4583196', 'JUBILACION ORDINARIA', None),
    ('4583569', 'JUBILACION ORDINARIA', None),
    ('4587848', 'JUBILACION ORDINARIA', None),
    ('4768393', 'JUBILACION ORDINARIA', None),
    ('4773822', 'JUBILACION ORDINARIA', None),
    ('4818784', 'JUBILACION ORDINARIA', None),
    ('4848386', 'JUBILACION ORDINARIA', None),
    ('4850380', 'JUBILACION ORDINARIA', None),
    ('4881699', 'PENSION DE INVALIDEZ', None),
    ('5007469', 'JUBILACION ORDINARIA', None),
    ('5012588', 'JUBILACION ORDINARIA', None),
    ('5114777', 'JUBILACION ORDINARIA', None),
    ('5137233', 'JUBILACION ORDINARIA', None),
    ('5220377', 'PENSION DE INVALIDEZ', None),
    ('5304192', 'PENSION DE INVALIDEZ', None),
    ('5310618', 'JUBILACION ORDINARIA', None),
    ('5419958', 'JUBILACION ORDINARIA', None),
    ('5425666', 'JUBILACION ORDINARIA', None),
    ('5532560', 'JUBILACION ORDINARIA', None),
    ('5541603', 'PENSION DE INVALIDEZ', None),
    ('5567083', 'JUBILACION ORDINARIA', None),
    ('5597407', 'PENSION DE INVALIDEZ', None),
    ('5612711', 'JUBILACION ORDINARIA', None),
    ('5894178', 'JUBILACION ORDINARIA', None),
    ('5966601', 'JUBILACION ORDINARIA', None),
    ('5967758', 'JUBILACION ORDINARIA', None),
    ('6029051', 'PENSION DE INVALIDEZ', None),
    ('6034198', 'JUBILACION ORDINARIA', None),
    ('6055530', 'JUBILACION ORDINARIA', None),
    ('6124503', 'JUBILACION ORDINARIA', None),
    ('6138676', 'JUBILACION ORDINARIA', None),
    ('6145325', 'JUBILACION ORDINARIA', None),
    ('6155986', 'JUBILACION ORDINARIA', None),
    ('6196230', 'JUBILACION ORDINARIA', None),
    ('6219468', 'JUBILACION ORDINARIA', None),
    ('6228795', 'JUBILACION ORDINARIA', None),
    ('6248439', 'JUBILACION ORDINARIA', None),
    ('6263595', 'JUBILACION ORDINARIA', None),
    ('6323490', 'JUBILACION ORDINARIA', None),
    ('6358192', 'JUBILACION ORDINARIA', None),
    ('6360432', 'JUBILACION ORDINARIA', None),
    ('6433299', 'JUBILACION ORDINARIA', None),
    ('6436666', 'JUBILACION ORDINARIA', None),
    ('6521503', 'JUBILACION ORDINARIA', None),
    ('6553856', 'JUBILACION ORDINARIA', None),
    ('6663529', 'JUBILACION ORDINARIA', None),
    ('6711910', 'JUBILACION ORDINARIA', None),
    ('6818167', 'PENSION DE INVALIDEZ', None),
    ('6820299', 'PENSION DE INVALIDEZ', None),
    ('6841144', 'JUBILACION ORDINARIA', None),
    ('6848287', 'JUBILACION ORDINARIA', None),
    ('6854647', 'JUBILACION ORDINARIA', None),
    ('6872580', 'JUBILACION ORDINARIA', None),
    ('6891632', 'JUBILACION ORDINARIA', None),
    ('6897148', 'JUBILACION ORDINARIA', None),
    ('6900609', 'PENSION DE INVALIDEZ', None),
    ('6913410', 'JUBILACION ORDINARIA', None),
    ('6917417', 'JUBILACION ORDINARIA', None),
    ('6930061', 'PENSION DE INVALIDEZ', None),
    ('6975231', 'PENSION DE INVALIDEZ', None),
    ('7141525', 'PENSION DE INVALIDEZ', None),
    ('7217316', 'PENSION DE INVALIDEZ', None),
    ('7921644', 'PENSION DE INVALIDEZ', None),
    ('8325605', 'PENSION DE INVALIDEZ', None),
    ('9118742', 'PENSION DE INVALIDEZ', None),
    ('9485121', 'PENSION DE INVALIDEZ', None),
    ('9963503', 'PENSION DE INVALIDEZ', None),
    ('10110360', 'JUBILACION ESPECIAL', None),
    ('10332822', 'JUBILACION ORDINARIA', None),
    ('10336046', 'JUBILACION ORDINARIA', None),
    ('10350849', 'JUBILACION ORDINARIA', None),
    ('10484501', 'PENSION DE INVALIDEZ', None),
    ('10510831', 'JUBILACION ORDINARIA', '2026-07-10'),
    ('10534267', 'JUBILACION ORDINARIA', None),
    ('10787262', 'PENSION DE INVALIDEZ', None),
    ('11091023', 'JUBILACION ORDINARIA', None),
    ('11226027', 'JUBILACION ORDINARIA', None),
    ('11306915', 'PENSION DE INVALIDEZ', None),
    ('11311029', 'JUBILACION ESPECIAL', None),
    ('11565492', 'JUBILACION ESPECIAL', None),
    ('11636254', 'JUBILACION ESPECIAL', None),
    ('11677610', 'JUBILACION ESPECIAL', None),
    ('11689255', 'JUBILACION ESPECIAL', None),
    ('11918398', 'JUBILACION ORDINARIA', None),
    ('12066861', 'PENSION POR SOBREVIVIENTE', None),
    ('12143491', 'PENSION DE INVALIDEZ', None),
    ('12258838', 'JUBILACION ESPECIAL', None),
    ('12396349', 'JUBILACION ESPECIAL', None),
    ('12628941', 'JUBILACION ORDINARIA', None),
    ('12638843', 'JUBILACION ESPECIAL', None),
    ('12763328', 'JUBILACION ORDINARIA', None),
    ('13310067', 'JUBILACION ORDINARIA', None),
    ('14202390', 'JUBILACION ESPECIAL', None),
    ('14385903', 'JUBILACION ESPECIAL', None),
    ('17762231', 'JUBILACION ORDINARIA', None),
]


def _existe_tabla(cursor, nombre: str) -> bool:
    cursor.execute('SELECT to_regclass(%s)', [f'"{nombre}"'])
    return cursor.fetchone()[0] is not None


def migrar_datos_pasivos_144(apps, schema_editor):
    conexion = schema_editor.connection
    if conexion.vendor != 'postgresql':
        return

    with conexion.cursor() as cursor:
        if not (_existe_tabla(cursor, 'Employee') and _existe_tabla(cursor, 'EmployeeEgresado')):
            return

        # 1. Obtener IDs de los motivos bajo PASE A PASIVO
        cursor.execute(
            'SELECT id FROM "RAC_categoria_movimiento" WHERE UPPER(categoria) = %s LIMIT 1',
            ['PASE A PASIVO'],
        )
        cat_row = cursor.fetchone()
        if not cat_row:
            return
        cat_id = cat_row[0]

        motivos_map = {}
        for nombre in ('JUBILACION ESPECIAL', 'JUBILACION ORDINARIA', 'PENSION DE INVALIDEZ', 'PENSION POR SOBREVIVIENTE'):
            cursor.execute(
                'SELECT id FROM "Tipo_movimiento" WHERE UPPER(movimiento) = %s AND "categoriaId" = %s LIMIT 1',
                [nombre, cat_id],
            )
            row = cursor.fetchone()
            if row:
                motivos_map[nombre] = row[0]
            else:
                cursor.execute(
                    'SELECT id FROM "Tipo_movimiento" WHERE UPPER(movimiento) = %s LIMIT 1',
                    [nombre],
                )
                r_otro = cursor.fetchone()
                if r_otro:
                    motivos_map[nombre] = r_otro[0]

        for cedula, tipo_nombre, fecha_fija in PASIVOS_144:
            cursor.execute(
                'SELECT "cedulaIdentidad" FROM "Employee" WHERE "cedulaIdentidad" = %s LIMIT 1',
                [cedula],
            )
            if not cursor.fetchone():
                continue

            motivo_id = motivos_map.get(tipo_nombre)
            if not motivo_id:
                continue

            cursor.execute(
                'SELECT id, fecha_egreso, "motivoEgresoId" FROM "EmployeeEgresado" WHERE "employeeCedula" = %s ORDER BY fecha_egreso DESC LIMIT 1',
                [cedula],
            )
            egreso = cursor.fetchone()

            if fecha_fija:
                fecha_vigencia = fecha_fija
            elif egreso and egreso[1]:
                fecha_vigencia = str(egreso[1])[:10]
            else:
                cursor.execute(
                    'SELECT fecha_actualizacion, codigo FROM "AsigTrabajo" WHERE "employeeCedula" = %s ORDER BY fecha_actualizacion DESC LIMIT 1',
                    [cedula],
                )
                asig = cursor.fetchone()
                if asig and asig[0]:
                    fecha_vigencia = str(asig[0])[:10]
                else:
                    fecha_vigencia = '2020-01-01'

            if not egreso:
                cursor.execute(
                    'SELECT "fechaIngreso" FROM antecedentes_servicio WHERE "empleadoId" = %s ORDER BY "fechaIngreso" ASC LIMIT 1',
                    [cedula],
                )
                ant = cursor.fetchone()
                cursor.execute(
                    'SELECT codigo FROM "AsigTrabajo" WHERE "employeeCedula" = %s ORDER BY fecha_actualizacion DESC LIMIT 1',
                    [cedula],
                )
                asig_cod = cursor.fetchone()
                n_contrato = asig_cod[0] if asig_cod else None
                fecha_ingreso = ant[0] if ant and ant[0] else fecha_vigencia

                cursor.execute(
                    'INSERT INTO "EmployeeEgresado" ("employeeCedula", fecha_egreso, "motivoEgresoId", "fechaIngresoOrganismo", n_contrato) '
                    'VALUES (%s, %s, %s, %s, %s)',
                    [cedula, fecha_vigencia, motivo_id, fecha_ingreso, n_contrato],
                )
            else:
                egreso_id = egreso[0]
                updates = []
                params = []
                if cedula in ('3403630', '10510831'):
                    updates.append("fecha_egreso = %s")
                    params.append(fecha_vigencia)
                    updates.append('"motivoEgresoId" = %s')
                    params.append(motivo_id)
                else:
                    if not egreso[1]:
                        updates.append("fecha_egreso = %s")
                        params.append(fecha_vigencia)
                    if not egreso[2]:
                        updates.append('"motivoEgresoId" = %s')
                        params.append(motivo_id)

                if updates:
                    params.append(egreso_id)
                    cursor.execute(
                        f'UPDATE "EmployeeEgresado" SET {", ".join(updates)} WHERE id = %s',
                        params,
                    )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_motivos_pase_a_pasivo_ordinaria_especial'),
    ]

    operations = [
        migrations.RunPython(migrar_datos_pasivos_144, reverse_code=migrations.RunPython.noop),
    ]
