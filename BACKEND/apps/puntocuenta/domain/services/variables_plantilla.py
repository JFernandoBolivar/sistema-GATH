"""Formato de fechas para los datos que el Punto de Cuenta envía al diseñador."""
from datetime import date, datetime

MESES_ES = (
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
)


def formatear_fecha_larga(fecha: str | datetime | date | None) -> str:
    """Formatea una fecha al estándar formal venezolano: ``5 de noviembre de 2026``."""
    if not fecha:
        dt = datetime.now()
    elif isinstance(fecha, (datetime, date)):
        dt = fecha
    else:
        texto = str(fecha).strip()
        dt = None
        for formato in ('%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%d/%m/%Y', '%d-%m-%Y'):
            try:
                dt = datetime.strptime(texto[:19], formato)
                break
            except ValueError:
                continue
        if dt is None:
            dt = datetime.now()
    return f'{dt.day} de {MESES_ES[dt.month - 1]} de {dt.year}'
