"""Puerto de generación del PDF mediante el diseñador de documentos.

La aplicación no conoce `apps.documentos`; el adaptador de infrastructure
traduce este contrato al servicio externo de documentos.
"""
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class DocumentoPuntoCuenta:
    id: str
    pdf_clave: str
    pdf_sha256: str
    plantilla_id: str = ''
    version_id: str = ''
    version_numero: int | None = None


class GeneradorPuntoCuenta(Protocol):
    def validar(self, proceso: str) -> None:
        """Exige una plantilla publicada y activa para ``punto_cuenta:<proceso>``."""
        ...

    def generar(
        self,
        proceso: str,
        *,
        sujeto_id: str,
        datos: dict[str, Any],
        actor_id: int | None,
        valores_propios: dict[str, Any] | None = None,
        trabajador_cedula: str = '',
    ) -> DocumentoPuntoCuenta:
        """Genera y guarda el documento; nunca recurre a textos locales."""
        ...
