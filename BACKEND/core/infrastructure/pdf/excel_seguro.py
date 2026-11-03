"""Neutraliza la inyección de fórmulas (CSV/Excel injection, OWASP) al escribir celdas.

openpyxl interpreta como FÓRMULA cualquier texto que empiece por '='. Un dato
controlado por un usuario ("=HYPERLINK(...)", "=cmd|...") se ejecutaría al
abrir el reporte. Se fuerza el tipo texto ('s'): el valor se ve igual, pero
Excel no lo evalúa.
"""


def forzar_texto(celda):
    """Si la celda quedó como fórmula a partir de un texto, la convierte en texto literal."""
    if isinstance(celda.value, str) and celda.data_type == 'f':
        celda.data_type = 's'
    return celda


def neutralizar_fila(ws, fila: int):
    """Aplica `forzar_texto` a todas las celdas de una fila ya escrita."""
    for celda in ws[fila]:
        forzar_texto(celda)
