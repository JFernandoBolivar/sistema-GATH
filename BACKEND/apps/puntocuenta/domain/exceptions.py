"""Excepciones propias de la emisión del Punto de Cuenta."""
from core.domain.exceptions import ConflictError, NotFoundError


class PlantillaPuntoCuentaFaltante(ConflictError):
    """El proceso no tiene una plantilla publicada y activa en el diseñador."""

    def __init__(self, proceso: str, descripcion: str = ''):
        self.proceso = proceso
        super().__init__(
            f'Falta la plantilla del Punto de Cuenta de {descripcion or proceso}. '
            'Publíquela y actívela en Documentos → Plantillas.',
            campo='proceso',
        )


class DocumentoPuntoCuentaNoDisponible(NotFoundError):
    """No se puede recuperar el PDF original de un registro histórico."""
