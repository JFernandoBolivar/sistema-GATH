"""
Caso de uso: emitir un carnet y devolver el PDF en la misma operación (O46-A).

Antes vivía en la vista `CarnetGenerarView`, que llamaba al repositorio dos
veces. La vista queda delgada y la secuencia (emitir → generar PDF) se prueba
sin DRF.

T2 (OC 2026-11-11): si la persona ya tiene un carnet vigente hay que indicar el
motivo de la reemisión (`PERDIDA_ROBO`, `DETERIORO`, `CAMBIO_DATOS`,
`CAMBIO_CARGO` u `OTRO` con detalle). El motivo se guarda en
`CarnetEmitido.motivo` (catálogo existente) y la vista lo audita.
"""
from dataclasses import dataclass
from datetime import datetime

from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.exceptions import ReemisionSinMotivoError
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from apps.carnetizacion.domain.services.motivo_reemision import (
    MOTIVO_OTRO,
    MotivoReemision,
    normalizar_reemision,
)


@dataclass(frozen=True)
class EmisionCarnet:
    """Resultado de emitir: el carnet nuevo, su PDF y el motivo de reemisión."""

    carnet: Carnet
    pdf: bytes
    motivo_reemision: str | None = None
    detalle: str = ''


def _fecha_dd_mm_aaaa(valor: str) -> str:
    try:
        return datetime.fromisoformat(str(valor)).strftime('%d/%m/%Y')
    except (TypeError, ValueError):
        return str(valor)


def _resumen_vigente(carnet: Carnet) -> dict:
    return {
        'emitido_en': carnet.fecha_emision,
        'numero': carnet.id,
        'id': carnet.id,
    }


def _observaciones_con_reemision(
    reemision: MotivoReemision | None, observaciones: str | None,
) -> str | None:
    if reemision is None:
        return observaciones
    texto = f'Reemisión: {reemision.motivo}'
    if reemision.motivo == MOTIVO_OTRO and reemision.detalle:
        texto = f'{texto} — {reemision.detalle}'
    base = (observaciones or '').strip()
    return f'{texto} | {base}' if base else texto


def emitir_carnet_y_pdf(
    repo: RepoCarnetizacion,
    *,
    empleado_cedula: str,
    motivo_id: int,
    observaciones: str | None = '',
    plantilla_id: str | int | None = None,
    nombre_override: str | None = None,
    motivo_reemision: str | None = None,
    detalle: str | None = None,
) -> EmisionCarnet:
    """Emite el carnet del empleado y devuelve el PDF binario generado."""
    reemision = normalizar_reemision(motivo_reemision, detalle)
    vigente = repo.obtener_carnet_vigente(empleado_cedula)
    if vigente is not None and reemision is None:
        raise ReemisionSinMotivoError(
            'Ya tiene un carnet vigente emitido el '
            f'{_fecha_dd_mm_aaaa(vigente.fecha_emision)}. '
            'Indique el motivo de la reemisión.',
            _resumen_vigente(vigente),
        )

    motivo_final = motivo_id
    if reemision is not None:
        catalogo = repo.motivo_id_para_reemision(reemision.motivo)
        if catalogo is not None:
            motivo_final = catalogo

    carnet = repo.emitir_carnet(
        empleado_cedula=empleado_cedula,
        motivo_id=motivo_final,
        observaciones=_observaciones_con_reemision(reemision, observaciones),
        plantilla_id=plantilla_id,
    )
    pdf = repo.generar_pdf(carnet_id=carnet.id, nombre_override=nombre_override)
    return EmisionCarnet(
        carnet=carnet,
        pdf=pdf,
        motivo_reemision=reemision.motivo if reemision else None,
        detalle=reemision.detalle if reemision else '',
    )


def listar_motivos_emision(repo: RepoCarnetizacion) -> list[dict]:
    """Motivos de emisión disponibles para el formulario de carnet."""
    return repo.listar_motivos_emision()
