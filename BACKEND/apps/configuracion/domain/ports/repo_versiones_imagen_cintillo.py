"""Puerto del histórico de versiones de las imágenes del cintillo (D-09)."""
from typing import Protocol

from ..entities.version_imagen_cintillo import VersionImagenCintillo


class RepoVersionesImagenCintillo(Protocol):
    def registrar(
        self, campo: str, clave: str, mime: str, tamano: int,
        usuario_id: int | None, usuario_cedula: str, maximo: int,
    ) -> tuple[VersionImagenCintillo, list[str]]:
        """Crea la versión como vigente (las demás del campo dejan de serlo), poda a
        `maximo` por campo (nunca la vigente) y devuelve las claves descartadas."""
        ...

    def listar(self, campo: str) -> list[VersionImagenCintillo]:
        """Más reciente primero."""
        ...

    def obtener(self, version_id: str) -> VersionImagenCintillo | None: ...

    def marcar_vigente(self, version_id: str) -> VersionImagenCintillo: ...
