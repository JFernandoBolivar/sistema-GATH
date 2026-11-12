"""Caso de uso: sugerencias de cargo y oficina para las reglas de color del diseñador."""
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion


def sugerencias_reglas_color(repo: RepoCarnetizacion) -> dict[str, list[str]]:
    """Valores reales (mayúsculas, ordenados, sin vacíos) que usa el PDF."""
    return repo.sugerencias_reglas_color()
