"""
Puerto del Repositorio de Configuración Visual (Reglas B1, B21, D-09).
"""
from typing import Protocol

from ..entities.configuracion_visual import ConfiguracionVisual


class RepoConfiguracionVisual(Protocol):
    def obtener(self) -> ConfiguracionVisual: ...

    def actualizar(self, datos: dict, usuario_id: int | None) -> ConfiguracionVisual: ...

    def guardar_logo(
        self, campo: str, clave: str, usuario_id: int | None
    ) -> ConfiguracionVisual:
        """`campo` es uno de 'logo_principal_clave', 'logo_secundario_clave', 'cintillo_pie_clave'."""
        ...
