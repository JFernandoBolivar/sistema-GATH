"""
Utilidades de desempaquetado de errores (R-03, B2.2).

`extract_first_error` vivía en `RAC/utils/data_formatters.py` y se usaba desde
~28 sitios de llamada en vistas de `RAC` y `AUTOGESTION` para desempaquetar a
mano el primer mensaje de error de un `serializer.errors` anidado.

Ese legado fue retirado (Fase 8). Las vistas de `apps/[modulo]/` usan
`serializer.is_valid(raise_exception=True)`, absorbido por
`core/presentation/exception_handler.py`, así que esta función queda como
utilidad pura sin call-sites de producción. Se conserva por si algún adaptador
necesita extraer el primer error anidado de un dict/list de DRF.
"""


def extract_first_error(errors):
    if isinstance(errors, dict):
        return extract_first_error(next(iter(errors.values()), ""))
    if isinstance(errors, list):
        return extract_first_error(errors[0])
    return str(errors)
