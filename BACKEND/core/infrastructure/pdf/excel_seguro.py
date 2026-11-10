"""Neutraliza la inyección de fórmulas (CSV/Excel injection, OWASP) al escribir celdas.

openpyxl interpreta como FÓRMULA cualquier texto que empiece por '='; Excel
además evalúa los que empiezan por '+', '-' y '@'. Un dato controlado por un
usuario ("=HYPERLINK(...)", "=cmd|...", "@SUM(...)") se ejecutaría al abrir el
reporte.

Dos barreras complementarias:

1. `neutralizar_valor` (texto, pura): antepone un apóstrofo al texto que empieza
   por esos caracteres, salvo que sea un número real (no se toca `-15`, `+3.5`)
   ni el marcador `-` suelto. El apóstrofo es la convención de Excel para
   "esto es texto, no lo evalúes".
2. `forzar_texto` / `neutralizar_fila` (celdas): si aun así openpyxl guardó la
   celda como fórmula, la deja como texto literal. Es la red de seguridad para
   los valores que se escriben sin pasar por `neutralizar_valor`.
"""
from decimal import Decimal, InvalidOperation

# Caracteres con los que Excel/Sheets comienza a evaluar una fórmula.
PREFIJOS_PELIGROSOS = ('=', '+', '-', '@')

# Con qué se marca una celda como texto literal en Excel.
PREFIJO_TEXTO = "'"


def es_numero(valor: str) -> bool:
    """`True` si `valor` es un número real (incluye signo, decimales y exponente)."""
    try:
        Decimal(valor)
    except (InvalidOperation, ValueError):
        return False
    return True


def neutralizar_valor(valor):
    """Devuelve el valor listo para una celda: el texto peligroso queda como texto.

    Solo se antepone `'` cuando la cadena empieza por ``= + - @`` y **no** es un
    número válido ni exactamente ``-`` (marcador de "sin dato" que usan las
    plantillas). Cualquier otro valor se devuelve intacto.
    """
    if not isinstance(valor, str) or not valor:
        return valor
    if valor[0] not in PREFIJOS_PELIGROSOS:
        return valor
    if valor == '-' or es_numero(valor):
        return valor
    return PREFIJO_TEXTO + valor


def neutralizar_fila_valores(valores) -> list:
    """Aplica `neutralizar_valor` a una fila completa antes de escribirla."""
    return [neutralizar_valor(valor) for valor in valores]


def forzar_texto(celda):
    """Si la celda quedó como fórmula a partir de un texto, la convierte en texto literal."""
    if isinstance(celda.value, str) and celda.data_type == 'f':
        celda.data_type = 's'
    return celda


def neutralizar_fila(ws, fila: int):
    """Aplica `forzar_texto` a todas las celdas de una fila ya escrita."""
    for celda in ws[fila]:
        forzar_texto(celda)
