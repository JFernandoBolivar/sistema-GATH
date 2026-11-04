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

# Fórmula de RRHH (2026-11-03): método comercial 30E/360 con día inclusivo según
# el mes de egreso y fusión de periodos solapados o contiguos. Reemplaza la
# versión anterior (+1 siempre, sin ajuste del día 31 ni fusión).

_MESES_DE_31_DIAS = {1, 3, 5, 7, 8, 10, 12}


def _ajustar_dia_30_360(dia: int) -> int:
    """Ajuste dia 31 -> 30 de la convencion europea 30E/360
    (equivalente al parametro VERDADERO de la funcion DIAS360 de Excel)."""
    return 30 if dia == 31 else dia


def calcular_tiempo_comercial(fecha_inicio: date, fecha_fin: date):
    """
    Retorna dict con years, months, days usando metodo comercial 30E/360.

    Suma 1 dia inclusivo (dia de inicio + dia de fin) solo cuando el mes de
    egreso tiene 30 dias o menos (abril, junio, septiembre, noviembre y
    febrero). Cuando el mes de egreso tiene 31 dias (enero, marzo, mayo,
    julio, agosto, octubre, diciembre) no se suma el dia inclusivo.
    """
    dia_inicio = _ajustar_dia_30_360(fecha_inicio.day)
    dia_fin = _ajustar_dia_30_360(fecha_fin.day)

    dia_inclusivo = 0 if fecha_fin.month in _MESES_DE_31_DIAS else 1

    dias_totales = (fecha_fin.year - fecha_inicio.year) * 360                  + (fecha_fin.month - fecha_inicio.month) * 30                  + (dia_fin - dia_inicio) + dia_inclusivo

    years = dias_totales // 360
    resto = dias_totales % 360
    months = resto // 30
    days = resto % 30
    return {"years": years, "months": months, "days": days, "total_dias": dias_totales}


def _fusionar_periodos(periodos):
    """Fusiona periodos contiguos o solapados (egreso de uno >= ingreso del
    siguiente) para no aplicar el dia inclusivo dos veces sobre la misma
    fecha frontera compartida entre antecedentes."""
    ordenados = sorted(periodos, key=lambda p: p[0])
    fusionados = []
    for inicio, fin in ordenados:
        if fusionados and inicio <= fusionados[-1][1]:
            ultimo_inicio, ultimo_fin = fusionados[-1]
            fusionados[-1] = (ultimo_inicio, max(ultimo_fin, fin))
        else:
            fusionados.append((inicio, fin))
    return fusionados


def calcular_total_apn(antecedentes_qs):
    """
    Suma todos los antecedentes cerrados y retorna el total.
    Los periodos contiguos o solapados se fusionan antes de calcular, para
    que el dia inclusivo se aplique una sola vez por segmento real de
    tiempo servido, no una vez por cada antecedente individual.

    Acepta un QuerySet, una lista o el RelatedManager de `antecedentes_servicio`
    (el manager de la relación inversa no es iterable directamente).
    """
    if hasattr(antecedentes_qs, "all"):
        antecedentes_qs = antecedentes_qs.all()
    periodos = [
        (ant.fecha_ingreso, ant.fecha_egreso)
        for ant in antecedentes_qs
        if ant.fecha_ingreso and ant.fecha_egreso
    ]

    total_dias = 0
    for inicio, fin in _fusionar_periodos(periodos):
        total_dias += calcular_tiempo_comercial(inicio, fin)["total_dias"]

    years = total_dias // 360
    resto = total_dias % 360
    months = resto // 30
    days = resto % 30
    return {"years": years, "months": months, "days": days}


def anios_fraccionarios(*, years: int, months: int, days: int) -> float:
    """Convierte el resultado oficial a años fraccionarios (G9).

    Es la ÚNICA conversión usada por `_total_anos_apn_calculado` y la que la
    anotación SQL debe reproducir (probada con tolerancia 1e-4).
    """
    return round(years + months / 12.0 + days / 365.0, 4)
