"""Valores derivados que la revisión muestra pero no se guardan (FIX hijo sin cédula).

Un hijo(a) menor sin cédula se guarda sin `cedula_generada`: la cédula
`<cédula del titular>-<orden>` la resuelve el alta del familiar al aprobar. Si
se persiste dentro de `valor_propuesto`, al reabrir el borrador el trabajador la
reenvía y la validación la rechaza como campo no autogestionable.
"""
from typing import Any

CAMPO_CEDULA_GENERADA = 'cedula_generada'


def con_cedula_generada(valor: Any, cedula_titular: str) -> Any:
    """Copia del valor propuesto con la cédula que se generará al aprobar.

    Solo para la respuesta de la revisión. Devuelve el valor intacto si no es un
    registro nuevo de familiar, si ya trae cédula propia o si ya viene el campo
    (borradores guardados antes del fix).
    """
    if not isinstance(valor, dict):
        return valor
    if CAMPO_CEDULA_GENERADA in valor:
        return valor
    if (valor.get('cedula_familiar') or '').strip():
        return valor
    orden = valor.get('orden_hijo')
    if orden in (None, ''):
        return valor
    try:
        return {**valor, CAMPO_CEDULA_GENERADA: f'{str(cedula_titular).strip()}-{int(orden)}'}
    except (TypeError, ValueError):
        return valor
