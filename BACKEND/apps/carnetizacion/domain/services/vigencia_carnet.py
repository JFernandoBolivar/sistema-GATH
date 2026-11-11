"""Cálculo de la fecha de vencimiento de un carnet (puro, sin Django).

Reglas: si el parámetro del tipo existe y es > 0 prevalece; si falta o vale 0 se usa el
respaldo global (meses). Si el respaldo tampoco es válido se usa `VIGENCIA_RESPALDO_MESES`.
"""
import calendar
from datetime import datetime, timedelta

VIGENCIA_RESPALDO_MESES = 12

TIPO_VIGENCIA_TRABAJADOR = 'trabajador'
TIPO_VIGENCIA_PASIVO = 'pasivo'
TIPO_VIGENCIA_EXTERNO = 'externo'


def sumar_meses(origen: datetime, meses: int) -> datetime:
    """Suma meses de calendario; si el día no existe en el mes destino toma el último."""
    indice = origen.month - 1 + meses
    anio = origen.year + indice // 12
    mes = indice % 12 + 1
    dia = min(origen.day, calendar.monthrange(anio, mes)[1])
    return origen.replace(year=anio, month=mes, day=dia)


def calcular_vencimiento(
    emision: datetime,
    *,
    tipo: str,
    valor_tipo: int,
    respaldo_meses: int,
) -> datetime:
    """`valor_tipo` son días para `externo` y meses para el resto."""
    if valor_tipo and valor_tipo > 0:
        if tipo == TIPO_VIGENCIA_EXTERNO:
            return emision + timedelta(days=valor_tipo)
        return sumar_meses(emision, valor_tipo)
    meses = respaldo_meses if respaldo_meses and respaldo_meses > 0 else VIGENCIA_RESPALDO_MESES
    return sumar_meses(emision, meses)
