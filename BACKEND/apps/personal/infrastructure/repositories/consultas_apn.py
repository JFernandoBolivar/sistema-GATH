"""
Anotación ORM de la antigüedad APN oficial (G9/D-05, ampliada en O8).

La fuente autoritativa es la fórmula de RRHH en
`apps.personal.shared.domain.services.tiempo_servicio.calcular_total_apn`
(Python): suma los antecedentes cerrados y el periodo EN CURSO en CONATEL
(antecedente abierto o, si falta, el contrato más reciente) hasta la fecha de
corte o de egreso. Fusiona los periodos solapados o contiguos antes de aplicar
el método comercial 30E/360, con el día inclusivo según el mes de egreso.

Aquí se reproduce lo mismo en SQL (islas con funciones de ventana) para que
los filtros y el orden del reporte coincidan con la ficha y el PDF. La fracción
de año es idéntica a `tiempo_servicio.anios_fraccionarios`.

Esta consulta NO toca `Employee.total_anos_apn` (columna legada mantenida por
`trg_actualizar_apn`, días/365.25 e incluye antecedentes abiertos).
"""
from datetime import date

from django.db.models import (
    ExpressionWrapper,
    F,
    FloatField,
    IntegerField,
)
from django.db.models.expressions import RawSQL
from django.db.models.functions import Floor

from apps.personal.infrastructure.models.expediente_models import ContratoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

# Nombre real de la columna (PostgreSQL distingue mayúsculas al ir entre comillas).
_COL_CEDULA = EmployeeModel._meta.get_field('cedulaidentidad').column
_COL_PK_CONTRATO = ContratoModel._meta.pk.column

# Días comerciales del empleado con la fórmula de RRHH. `periodos` contiene los
# antecedentes cerrados y, si se puede determinar, el tramo CONATEL en curso.
# Parámetros: fecha de corte (2 veces: fin del tramo y respaldo del egreso).
_SQL_TOTAL_DIAS = """
COALESCE((
    WITH periodos AS (
        SELECT a."fechaIngreso" AS ini, a."fechaEgreso" AS fin
        FROM antecedentes_servicio a
        WHERE a."empleadoId" = "Employee"."id"
          AND a."fechaIngreso" IS NOT NULL
          AND a."fechaEgreso" IS NOT NULL
        UNION ALL
        SELECT z.inicio AS ini, z.fin AS fin
        FROM (
            SELECT
                COALESCE(
                    (SELECT MIN(a2."fechaIngreso")
                     FROM antecedentes_servicio a2
                     WHERE a2."empleadoId" = "Employee"."id"
                       AND a2."fechaEgreso" IS NULL),
                    (SELECT ant."fechaIngreso"
                     FROM contratos c
                     JOIN antecedentes_servicio ant ON ant.id = c."antecedente_id_id"
                     WHERE ant."empleadoId" = "Employee"."id"
                       AND EXISTS (
                           SELECT 1
                           FROM "AsigTrabajo" asig
                           JOIN "Estatus" est ON est.id = asig."estatusId"
                           LEFT JOIN "TipoPersonal" tp ON tp.id = asig."tipoPersonalId"
                           WHERE asig."employeeCedula" = "Employee"."__COL_CEDULA__"
                             AND UPPER(est.estatus) = 'ACTIVO'
                             AND (asig."tipoPersonalId" IS NULL OR UPPER(tp."tipoPersonal") = 'ACTIVO')
                       )
                     ORDER BY c."__COL_PK_CONTRATO__" DESC
                     LIMIT 1)
                ) AS inicio,
                LEAST(
                    %s::date,
                    COALESCE(
                        (SELECT MIN(ee."fecha_egreso"::date)
                         FROM "EmployeeEgresado" ee
                         WHERE ee."employeeCedula" = "Employee"."__COL_CEDULA__"),
                        %s::date
                    )
                ) AS fin
        ) z
        WHERE z.inicio IS NOT NULL AND z.fin >= z.inicio
    ),
    islas AS (
        SELECT MIN(g.ini) AS ini, MAX(g.fin) AS fin
        FROM (
            SELECT m.ini, m.fin,
                   SUM(m.nuevo) OVER (ORDER BY m.ini, m.fin ROWS UNBOUNDED PRECEDING) AS grupo
            FROM (
                SELECT p.ini, p.fin,
                       CASE WHEN p.ini <= MAX(p.fin) OVER (
                                ORDER BY p.ini, p.fin
                                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
                            THEN 0 ELSE 1 END AS nuevo
                FROM periodos p
            ) m
        ) g
        GROUP BY g.grupo
    )
    SELECT SUM(
        (EXTRACT(YEAR FROM t.fin) - EXTRACT(YEAR FROM t.ini)) * 360
        + (EXTRACT(MONTH FROM t.fin) - EXTRACT(MONTH FROM t.ini)) * 30
        + (LEAST(EXTRACT(DAY FROM t.fin), 30) - LEAST(EXTRACT(DAY FROM t.ini), 30))
        + CASE WHEN EXTRACT(MONTH FROM t.fin) IN (1, 3, 5, 7, 8, 10, 12) THEN 0 ELSE 1 END
    )::integer
    FROM islas t
), 0)
"""

_SQL_TOTAL_DIAS = _SQL_TOTAL_DIAS.replace(
    '__COL_CEDULA__', _COL_CEDULA
).replace('__COL_PK_CONTRATO__', _COL_PK_CONTRATO)

_ANIOS = Floor(F('_apn_dias') / 360.0)
_RESTO = ExpressionWrapper(
    F('_apn_dias') - _ANIOS * 360.0, output_field=FloatField()
)
_MESES = Floor(_RESTO / 30.0)
_DIAS_RESTO = ExpressionWrapper(
    _RESTO - _MESES * 30.0, output_field=FloatField()
)
_ANIOS_FRACCION = ExpressionWrapper(
    _ANIOS + _MESES / 12.0 + _DIAS_RESTO / 365.0,
    output_field=FloatField(),
)


def anotar_apn_oficial(queryset, fecha_corte=None):
    """Anota `apn_oficial` (años fraccionarios) sin leer la columna legada."""
    corte = fecha_corte or date.today()
    total_dias = RawSQL(_SQL_TOTAL_DIAS, [corte, corte], output_field=IntegerField())
    return queryset.annotate(_apn_dias=total_dias).annotate(
        apn_oficial=_ANIOS_FRACCION
    )
