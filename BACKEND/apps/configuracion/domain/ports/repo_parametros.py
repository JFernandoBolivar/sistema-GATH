"""Puerto del repositorio de parámetros del sistema (puerto + historial)."""
from typing import Protocol

from apps.configuracion.domain.entities.parametro import CambioParametro, ParametroSistema


class RepoParametros(Protocol):
    def listar(self) -> list[ParametroSistema]:
        """Todos los parámetros, sincronizando los metadatos de las definiciones."""
        ...

    def obtener(self, clave: str) -> ParametroSistema | None: ...

    def guardar(self, parametro: ParametroSistema, actor_id: int | None) -> ParametroSistema: ...

    def historial(
        self, clave: str, limite: int, offset: int = 0
    ) -> tuple[list[CambioParametro], int]:
        """Cambios del parámetro desde la auditoría, del más reciente al más antiguo."""
        ...
