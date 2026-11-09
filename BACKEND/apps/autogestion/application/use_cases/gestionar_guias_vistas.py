"""
Casos de uso para consultar y registrar guías interactivas vistas por cuenta (O35).
"""
from apps.autogestion.domain.entities.guia_vista import GuiaVista
from apps.autogestion.domain.ports.repo_guia_vista import RepoGuiaVista


class ConsultarGuiasVistasUseCase:
    """Consulta las guías vistas por el trabajador autenticado."""

    def __init__(self, repo: RepoGuiaVista):
        self._repo = repo

    def ejecutar(self, cedula: str) -> list[GuiaVista]:
        if not cedula:
            return []
        return self._repo.listar_vistas_por_cedula(cedula)


class MarcarGuiaVistaUseCase:
    """Registra la visualización completa de una guía para una versión específica."""

    def __init__(self, repo: RepoGuiaVista):
        self._repo = repo

    def ejecutar(self, cedula: str, guia_id: str, version: int = 1) -> GuiaVista:
        if not cedula:
            raise ValueError("La cédula es requerida.")
        if not guia_id or not guia_id.strip():
            raise ValueError("El identificador de la guía es requerido.")
        if version < 1:
            raise ValueError("La versión de la guía debe ser mayor o igual a 1.")

        return self._repo.registrar_vista(cedula.strip(), guia_id.strip(), version)
