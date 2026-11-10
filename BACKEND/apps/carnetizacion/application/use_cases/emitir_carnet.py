"""
Caso de uso: emitir un carnet y devolver el PDF en la misma operación (O46-A).

Antes vivía en la vista `CarnetGenerarView`, que llamaba al repositorio dos
veces. La vista queda delgada y la secuencia (emitir → generar PDF) se prueba
sin DRF.
"""
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion


def emitir_carnet_y_pdf(
    repo: RepoCarnetizacion,
    *,
    empleado_cedula: str,
    motivo_id: int,
    observaciones: str | None = '',
    plantilla_id: str | int | None = None,
    nombre_override: str | None = None,
) -> bytes:
    """Emite el carnet del empleado y devuelve el PDF binario generado."""
    carnet = repo.emitir_carnet(
        empleado_cedula=empleado_cedula,
        motivo_id=motivo_id,
        observaciones=observaciones,
        plantilla_id=plantilla_id,
    )
    return repo.generar_pdf(carnet_id=carnet.id, nombre_override=nombre_override)


def listar_motivos_emision(repo: RepoCarnetizacion) -> list[dict]:
    """Motivos de emisión disponibles para el formulario de carnet."""
    return repo.listar_motivos_emision()
