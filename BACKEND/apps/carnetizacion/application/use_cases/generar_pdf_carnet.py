"""
Caso de uso para generar el PDF físico de un carnet ya emitido (Fase 2.3 del
plan de reparación, `PLAN_REPARACION_GATH.md`).
"""
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion


def generar_pdf_carnet(repo: RepoCarnetizacion, carnet_id: int, imprenta: bool = False) -> bytes:
    """PDF del carnet emitido. En formato normal se entrega la copia guardada al emitir (B-4),
    idéntica a la que se imprimió; sin copia válida, o en formato imprenta (B-3), se regenera."""
    if imprenta:
        return repo.generar_pdf(carnet_id, imprenta=True)
    guardado = repo.pdf_emitido_guardado(carnet_id)
    if guardado is not None:
        return guardado
    return repo.generar_pdf(carnet_id)
