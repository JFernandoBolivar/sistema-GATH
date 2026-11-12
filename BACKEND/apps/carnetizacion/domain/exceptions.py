"""
Excepciones del dominio de carnetización.
"""
from typing import Any

from core.domain.exceptions import ConflictError


class ReemisionSinMotivoError(ConflictError):
    """La persona ya tiene un carnet vigente y no se indicó el motivo de la reemisión.

    Lleva el resumen del carnet vigente para que la vista arme el 409 con
    `data.carnet_vigente` sin volver a consultar la base.
    """

    def __init__(self, mensaje: str, carnet_vigente: dict[str, Any]):
        super().__init__(mensaje, campo='motivo_reemision')
        self.carnet_vigente = carnet_vigente
