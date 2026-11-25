"""Puertos de la integración documental de Movimientos.

Dominio y aplicación no conocen `apps.documentos`, Django ni el almacén de PDF.
El adaptador concreto vive en `movimientos.infrastructure`.
"""

from dataclasses import dataclass
from typing import Protocol

from apps.movimientos.domain.entities.movimiento import MovimientoCargo

# Metadato persistido en el snapshot para identificar de forma inequívoca el
# movimiento al que pertenece el documento.
CLAVE_MOVIMIENTO_ID = 'movimiento_id'


@dataclass(frozen=True)
class PlantillaDocumentoMovimiento:
    id: str
    codigo: str = ''
    nombre: str = ''


@dataclass(frozen=True)
class DocumentoGeneradoMovimiento:
    id: str
    plantilla_id: str
    sujeto_tipo: str
    sujeto_id: str
    datos_snapshot: dict
    pdf_sha256: str
    version_numero: int = 0


class GeneradorDocumentosMovimiento(Protocol):
    """Contrato estrecho del servicio externo de documentos usado por Movimientos."""

    def plantillas_activas(self, proceso: str) -> list[PlantillaDocumentoMovimiento]:
        """Plantillas publicadas y activas; una lista vacía implica no-op."""
        ...

    def generar_plantilla(
        self,
        plantilla_id: str,
        *,
        sujeto_tipo: str,
        sujeto_id: str,
        datos: dict,
        actor_id: int | None,
        valores_propios: dict | None = None,
        trabajador_cedula: str = '',
        estricto: bool = True,
    ) -> DocumentoGeneradoMovimiento:
        """Genera el PDF, su snapshot y su SHA-256 de una plantilla concreta."""
        ...


class ProveedorTrabajadorMovimiento(Protocol):
    """Datos reales del trabajador necesarios para completar el snapshot."""

    def datos_de(
        self,
        cedula: str,
        *,
        movimiento: MovimientoCargo,
        evento: dict | None = None,
    ) -> dict:
        ...
