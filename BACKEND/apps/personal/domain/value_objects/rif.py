"""
RIF venezolano del trabajador (Registro de Información Fiscal del SENIAT). Puro: sin Django.

Formato canónico `L-NNNNNNNN-D`: una letra de tipo (V venezolano, E extranjero, J jurídico, P pasaporte, G gubernamental),
ocho dígitos y un dígito verificador. Se aceptan mayúsculas o minúsculas, con o sin guiones o espacios, y un cuerpo de
7 u 8 dígitos (el de 7 se completa con un cero a la izquierda, como lo imprime el SENIAT para cédulas cortas).

No se recalcula el dígito verificador: el algoritmo del SENIAT tiene variantes y rechazar un RIF real es peor que aceptar
uno mal tecleado, que RRHH puede corregir en la ficha.
"""
import re

from core.domain.exceptions import ValidationError

LETRAS_RIF = 'VEJPG'
_PATRON = re.compile(rf'^([{LETRAS_RIF}])(\d{{7,8}})(\d)$')


def normalizar_rif(valor, *, campo: str = 'rif') -> str:
    """`'v-12345678-9'` -> `'V-12345678-9'`. Vacío o `None` -> `''` (el RIF es opcional). Lanza `ValidationError`."""
    if valor is None:
        return ''
    if not isinstance(valor, str):
        raise ValidationError("El RIF debe ser un texto.", campo=campo)
    compacto = re.sub(r'[\s\-]', '', valor).upper()
    if not compacto:
        return ''
    m = _PATRON.match(compacto)
    if m is None:
        raise ValidationError(
            f"El RIF no tiene un formato válido: use una letra ({', '.join(LETRAS_RIF)}), el número y el dígito "
            "verificador, por ejemplo V-12345678-9.", campo=campo,
        )
    letra, cuerpo, digito = m.groups()
    return f'{letra}-{cuerpo.zfill(8)}-{digito}'
