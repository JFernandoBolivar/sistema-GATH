"""Puerto del RIF y los idiomas del trabajador (activo o pasivo)."""
from typing import Protocol


class RepoRifIdiomas(Protocol):
    def existe_trabajador(self, cedula: str) -> bool:
        ...

    def rif_de(self, cedula: str) -> str | None:
        ...

    def guardar_rif(self, cedula: str, rif: str | None) -> None:
        ...

    def idiomas_de(self, cedula: str) -> list[dict]:
        """`[{id, idioma_id, idioma_nombre, otro_idioma, nombre, nivel}]` del trabajador."""
        ...

    def reemplazar_idiomas(self, cedula: str, idiomas: list[dict]) -> None:
        """Deja exactamente `idiomas` (normalizados). Lanza `ValidationError` si un `idioma_id` no existe."""
        ...
