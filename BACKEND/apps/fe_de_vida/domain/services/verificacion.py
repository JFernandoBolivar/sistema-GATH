"""Reglas puras de la verificación de constancias por QR: formato del código y enmascarado de la cédula. Sin Django."""
import re

LONGITUD_CODIGO_VERIFICACION = 64
CARACTER_OCULTO = '*'
_PATRON_CODIGO = re.compile(rf'^[0-9a-f]{{{LONGITUD_CODIGO_VERIFICACION}}}$')


def codigo_con_formato_valido(codigo: str) -> bool:
    """El código del QR es un hash hexadecimal en minúsculas; cualquier otra cosa ni se consulta."""
    return bool(_PATRON_CODIGO.match(codigo or ''))


def enmascarar_cedula(cedula: str) -> str:
    """
    Oculta los dígitos centrales conservando extremos: 7 o más dígitos muestran 2 al inicio y 2 al final
    (10079123 -> «10****23»); de 5 a 6 muestran 1 y 1; con 4 o menos se oculta todo. La longitud se conserva.
    """
    valor = (cedula or '').strip()
    visibles = 2 if len(valor) >= 7 else 1 if len(valor) >= 5 else 0
    if not visibles:
        return CARACTER_OCULTO * len(valor)
    return valor[:visibles] + CARACTER_OCULTO * (len(valor) - 2 * visibles) + valor[-visibles:]
