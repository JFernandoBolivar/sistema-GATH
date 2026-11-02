"""
Cabeceras de truncado de los documentos descargables (PDF/Excel).

Un documento puede cortarse en `REPORTES_MAX_FILAS*`; el backend lo informa en
estas cabeceras y la UI avisa al usuario. Viven en `core/` (B16) porque las
usan varios módulos (reportes y movimientos) y el nombre de la cabecera no debe
repetirse como literal.
"""

CABECERA_TOTAL = 'X-Reporte-Total-Registros'
CABECERA_LIMITE = 'X-Reporte-Limite'
CABECERA_TRUNCADO = 'X-Reporte-Truncado'


def aplicar_cabeceras_de_truncado(
    respuesta, *, total_encontrados: int, limite: int, truncado: bool,
) -> None:
    """Agrega a la respuesta HTTP el tamaño del resultado y si se truncó."""
    respuesta[CABECERA_TOTAL] = str(total_encontrados)
    respuesta[CABECERA_LIMITE] = str(limite)
    respuesta[CABECERA_TRUNCADO] = 'true' if truncado else 'false'
