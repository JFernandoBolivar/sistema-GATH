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

    def validar_cuentas_activas(self, cedulas: list[str]) -> list[tuple[str, str]]:
        """Valida que cada cédula exista como trabajador y tenga cuenta activa en GATH."""
        ...

    def obtener_nombres_por_cedulas(self, cedulas: list[str]) -> dict[str, str]:
        """Nombres de los trabajadores indexados por cédula."""
        ...

    def buscar_trabajadores(self, query: str, cedulas: list[str] | None = None) -> list[dict]:
        """Búsqueda de trabajadores con cuenta de usuario para el selector."""
        ...
