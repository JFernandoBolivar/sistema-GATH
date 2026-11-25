"""Puerto de lectura del documento ya guardado para conservar su PDF original."""
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class DocumentoGuardado:
    id: str
    pdf_clave: str
    pdf_sha256: str = ''
    version_id: str = ''
    version_numero: int | None = None


class RepoDocumentoGenerado(Protocol):
    def obtener(self, documento_id: str) -> DocumentoGuardado | None: ...
