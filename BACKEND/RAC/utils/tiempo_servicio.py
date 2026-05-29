from datetime import date


def calcular_tiempo_comercial(fecha_inicio: date, fecha_fin: date):
    """Retorna dict con years, months, days usando metodo comercial 30/360"""
    dias_totales = (fecha_fin.year - fecha_inicio.year) * 360 \
                 + (fecha_fin.month - fecha_inicio.month) * 30 \
                 + (fecha_fin.day - fecha_inicio.day)
    years = dias_totales // 360
    resto = dias_totales % 360
    months = resto // 30
    days = resto % 30
    return {"years": years, "months": months, "days": days, "total_dias": dias_totales}


def calcular_total_apn(antecedentes_qs):
    """Suma todos los antecedentes cerrados y retorna el total"""
    total_dias = 0
    for ant in antecedentes_qs:
        if ant.fecha_ingreso and ant.fecha_egreso:
            total_dias += (ant.fecha_egreso.year - ant.fecha_ingreso.year) * 360 \
                        + (ant.fecha_egreso.month - ant.fecha_ingreso.month) * 30 \
                        + (ant.fecha_egreso.day - ant.fecha_ingreso.day)
    years = total_dias // 360
    resto = total_dias % 360
    months = resto // 30
    days = resto % 30
    return {"years": years, "months": months, "days": days}
