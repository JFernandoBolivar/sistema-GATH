"""
Cálculo de tiempo de servicio / APN (R-05, B4.3).

Vivía en `RAC/utils/tiempo_servicio.py`. Se traslada tal cual (sin cambiar
comportamiento) al paquete de dominio compartido entre `personal` activo y
pasivo (`apps/personal/shared/domain/services/`), porque `apps/personal`
todavía no separa submódulos `activo/`/`pasivo/` propios (B4.3/B4.4) y esta
lógica la usan serializers de ambos flujos.

Módulo puro (sin Django, sin ORM — regla B1): solo `datetime`.

⚠️ RIESGO DOCUMENTADO (D-05, pendiente — NO resuelto en esta tarea): el
modelo `Employee`/`EmployeeModel` persiste una columna `total_anos_apn`
(`DecimalField`, ver `RAC/models/personal_models.py` y
`apps/personal/infrastructure/models/personal_models.py:14`) que, según el
plan (§I.2.2 R-05, decisión D-05), se sospecha calculada también por un
trigger PL/pgSQL en producción. Eso significa que el "años de servicio" que
ve el usuario puede depender de **dos fuentes de cálculo distintas** (este
módulo Python vs. el trigger de BD) y no hay hoy evidencia de cuál gana en
cada pantalla. La decisión D-05 exige auditar el trigger real en producción
(acción pendiente **A-02**, DBA/Operaciones) y unificar en una única fuente
autoritativa (**B18**: prohibida la duplicación de reglas de negocio en
Python y BD). Resolver esa auditoría y la unificación está fuera de alcance
de esta reubicación mecánica.
"""
from datetime import date


def calcular_tiempo_comercial(fecha_inicio: date, fecha_fin: date):
    """
    Retorna dict con years, months, days usando metodo comercial 30/360
    Incluye 1 día adicional por el período (día de inicio + día de fin)
    """
    # Suma 1 día al cálculo base para incluir el día de inicio en el cómputo
    dias_totales = (fecha_fin.year - fecha_inicio.year) * 360 \
                 + (fecha_fin.month - fecha_inicio.month) * 30 \
                 + (fecha_fin.day - fecha_inicio.day) + 1

    years = dias_totales // 360
    resto = dias_totales % 360
    months = resto // 30
    days = resto % 30
    return {"years": years, "months": months, "days": days, "total_dias": dias_totales}


def calcular_total_apn(antecedentes_qs):
    """
    Suma todos los antecedentes cerrados y retorna el total
    Cada antecedente ya incluye el día adicional en calcular_tiempo_comercial
    """
    total_dias = 0
    for ant in antecedentes_qs:
        if ant.fecha_ingreso and ant.fecha_egreso:
            total_dias += calcular_tiempo_comercial(ant.fecha_ingreso, ant.fecha_egreso)["total_dias"]

    years = total_dias // 360
    resto = total_dias % 360
    months = resto // 30
    days = resto % 30
    return {"years": years, "months": months, "days": days}
