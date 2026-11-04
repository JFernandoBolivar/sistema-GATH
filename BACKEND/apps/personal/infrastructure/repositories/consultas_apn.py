"""
Anotación ORM de la antigüedad APN oficial (G9, decisión D-05).

La fuente autoritativa es la fórmula de RRHH en
`apps.personal.shared.domain.services.tiempo_servicio.calcular_total_apn`
(Python), que suma SOLO antecedentes con `fecha_ingreso` y `fecha_egreso`:

1. Fusiona los periodos solapados o contiguos (ingreso <= egreso del anterior).
2. Para cada tramo fusionado, método comercial 30E/360:

    dias = (año_egreso - año_ingreso) * 360
         + (mes_egreso - mes_ingreso) * 30
         + (min(día_egreso, 30) - min(día_ingreso, 30))
         + (0 si el mes de egreso tiene 31 días, si no 1)

Aquí se reproduce lo mismo en SQL (islas con funciones de ventana) para que
los filtros y el orden del reporte coincidan con la ficha y el PDF.

La fracción de año debe ser idéntica a
`tiempo_servicio.anios_fraccionarios`: años + meses/12 + días/365.

Esta consulta NO toca `Employee.total_anos_apn` (columna legada mantenida por
`trg_actualizar_apn`, días/365.25 e incluye antecedentes abiertos).
"""
from django.db.models import (
    ExpressionWrapper,
    F,
    FloatField,
    IntegerField,
)
from django.db.models.expressions import RawSQL
from django.db.models.functions import Floor

# Días comerciales del empleado con la fórmula de RRHH: primero se agrupan
# los antecedentes cerrados en tramos fusionados (un antecedente abre tramo
# nuevo solo si empieza después del mayor egreso anterior) y luego se aplica
# 30E/360 a cada tramo.
_SQL_TOTAL_DIAS = """
COALESCE((
    SELECT SUM(
        (EXTRACT(YEAR FROM t.fin) - EXTRACT(YEAR FROM t.ini)) * 360
        + (EXTRACT(MONTH FROM t.fin) - EXTRACT(MONTH FROM t.ini)) * 30
        + (LEAST(EXTRACT(DAY FROM t.fin), 30) - LEAST(EXTRACT(DAY FROM t.ini), 30))
        + CASE WHEN EXTRACT(MONTH FROM t.fin) IN (1, 3, 5, 7, 8, 10, 12) THEN 0 ELSE 1 END
    )::integer
    FROM (
        SELECT MIN(g.ini) AS ini, MAX(g.fin) AS fin
        FROM (
            SELECT m.ini, m.fin,
                   SUM(m.nuevo) OVER (ORDER BY m.ini, m.fin ROWS UNBOUNDED PRECEDING) AS grupo
            FROM (
                SELECT a."fechaIngreso" AS ini, a."fechaEgreso" AS fin,
                       CASE WHEN a."fechaIngreso" <= MAX(a."fechaEgreso") OVER (
                                ORDER BY a."fechaIngreso", a."fechaEgreso"
                                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
                            THEN 0 ELSE 1 END AS nuevo
                FROM antecedentes_servicio a
                WHERE a."empleadoId" = "Employee"."id"
                  AND a."fechaIngreso" IS NOT NULL
                  AND a."fechaEgreso" IS NOT NULL
            ) m
        ) g
        GROUP BY g.grupo
    ) t
), 0)
"""
_TOTAL_DIAS = RawSQL(_SQL_TOTAL_DIAS, [], output_field=IntegerField())

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


def anotar_apn_oficial(queryset):
    """Anota `apn_oficial` (años fraccionarios) sin leer la columna legada."""
    return queryset.annotate(_apn_dias=_TOTAL_DIAS).annotate(
        apn_oficial=_ANIOS_FRACCION
    )
