"""
Utilidades de desempaquetado de errores (R-03, B2.2).

`extract_first_error` vivía en `RAC/utils/data_formatters.py` y se usa desde
~28 sitios de llamada en vistas de `RAC` y `AUTOGESTION` para desempaquetar a
mano el primer mensaje de error de un `serializer.errors` anidado.

El plan (§I.2.2, R-03) marca esta función como "absorbida" por
`core/presentation/exception_handler.py`, pero portar esos ~28 call-sites al
patrón de manejo de excepciones centralizado es un cambio de comportamiento
observable (cambia la forma del cuerpo de error devuelto en cada endpoint) y
queda **fuera de alcance** de esta reubicación mecánica: se migrará vista por
vista cuando cada módulo legado se porte a su `apps/[modulo]/` definitivo.
Ver el comentario en `core/presentation/exception_handler.py` para el estado
de ese trabajo pendiente.

Por ahora, solo se traslada la función tal cual (sin tocar comportamiento) y
`RAC/utils/data_formatters.py` mantiene el re-export de compatibilidad hacia
atrás.
"""


def extract_first_error(errors):
    if isinstance(errors, dict):
        return extract_first_error(next(iter(errors.values()), ""))
    if isinstance(errors, list):
        return extract_first_error(errors[0])
    return str(errors)
