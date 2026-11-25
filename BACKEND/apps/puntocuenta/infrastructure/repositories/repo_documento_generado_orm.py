"""Adaptador de lectura de documentos guardados para descargas del Punto de Cuenta."""
from apps.documentos.infrastructure.repositories.repo_documentos_orm import (
    RepoDocumentosORM,
)
from apps.puntocuenta.domain.ports.repo_documento_generado import (
    DocumentoGuardado,
    RepoDocumentoGenerado,
)


class RepoDocumentoGeneradoORM:
    def __init__(self, repo=None):
        self.repo = repo or RepoDocumentosORM()

    def obtener(self, documento_id: str) -> DocumentoGuardado | None:
        documento = self.repo.obtener_generado(documento_id)
        if documento is None:
            return None
        return DocumentoGuardado(
            id=str(documento.id),
            pdf_clave=documento.pdf_clave,
            pdf_sha256=documento.pdf_sha256,
            version_id=str(documento.version_id),
            version_numero=documento.version_numero,
        )


def obtener_repo_documento_generado() -> RepoDocumentoGenerado:
    return RepoDocumentoGeneradoORM()
