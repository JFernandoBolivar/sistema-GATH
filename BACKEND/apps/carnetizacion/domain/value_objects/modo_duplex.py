"""Modo de impresión del lote de carnets y credenciales (B-6).

El lote dibuja todos los anversos en unas páginas y todos los reversos en las siguientes.
Según cómo voltee la hoja la impresora (o cómo la reinyecte el operador), el reverso debe
espejarse en columnas (doble cara por el borde largo), en filas (borde corto) o no
espejarse. Lo elige el operador al generar el PDF: no todos los equipos imprimen igual.

Puro: sin Django (regla B1).
"""
from core.domain.exceptions import ValidationError

SIN_ESPEJO = 'ninguno'
BORDE_LARGO = 'largo'
BORDE_CORTO = 'corto'

MODOS = (SIN_ESPEJO, BORDE_LARGO, BORDE_CORTO)

ETIQUETAS = {
    SIN_ESPEJO: 'Una cara o sin espejado',
    BORDE_LARGO: 'Doble cara por el borde largo',
    BORDE_CORTO: 'Doble cara por el borde corto',
}

_MENSAJE = 'Modo de impresión no válido. Use «ninguno», «largo» o «corto».'


def normalizar_modo(valor: object) -> str:
    """Normaliza y valida el modo recibido del cliente. Vacío = sin espejado."""
    modo = str(valor or SIN_ESPEJO).strip().lower()
    if modo not in MODOS:
        raise ValidationError(_MENSAJE, campo='modo_duplex')
    return modo
