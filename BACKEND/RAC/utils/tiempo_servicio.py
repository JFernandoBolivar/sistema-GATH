from datetime import date


def _ajustar_dia_30_360(dia: int) -> int:
    """Ajuste dia 31 -> 30 de la convencion europea 30E/360
    (equivalente al parametro VERDADERO de la funcion DIAS360 de Excel)."""
    return 30 if dia == 31 else dia


def calcular_tiempo_comercial(fecha_inicio: date, fecha_fin: date):
    """
    Retorna dict con years, months, days usando metodo comercial 30E/360
    Incluye 1 día adicional por el período (día de inicio + día de fin)
    """
    dia_inicio = _ajustar_dia_30_360(fecha_inicio.day)
    dia_fin = _ajustar_dia_30_360(fecha_fin.day)

    # Suma 1 día al cálculo base para incluir el día de inicio en el cómputo
    dias_totales = (fecha_fin.year - fecha_inicio.year) * 360 \
                 + (fecha_fin.month - fecha_inicio.month) * 30 \
                 + (dia_fin - dia_inicio) + 1

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
    """
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
