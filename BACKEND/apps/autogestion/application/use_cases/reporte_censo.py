"""
Caso de uso para consultar el consolidado del censo por dependencias (RRHH).
"""
from apps.autogestion.domain.ports.repo_autogestion import RepoAutogestion


def obtener_reporte_censo_dependencias(
    repo: RepoAutogestion, dependencias_ids: list[int] | None = None
) -> list[dict]:
    return repo.obtener_reporte_dependencias(dependencias_ids=dependencias_ids)
