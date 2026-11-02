"""
Caso de uso para generar el PDF físico de un carnet ya emitido (Fase 2.3 del
plan de reparación, `PLAN_REPARACION_GATH.md`).
"""
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion


def generar_pdf_carnet(repo: RepoCarnetizacion, carnet_id: int) -> bytes:
    return repo.generar_pdf(carnet_id)
