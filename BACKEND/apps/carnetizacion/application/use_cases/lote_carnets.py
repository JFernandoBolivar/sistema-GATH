"""Impresión por lote de carnets de trabajadores (B-6): cola de pendientes y PDF del lote."""
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from apps.carnetizacion.domain.value_objects.modo_duplex import SIN_ESPEJO, normalizar_modo
from core.domain.exceptions import ValidationError


def cola_impresion_uc(repo: RepoCarnetizacion) -> list[dict]:
    return repo.cola_impresion_carnets()


def generar_lote_carnets_uc(
    repo: RepoCarnetizacion, carnet_ids: object, marcar_impresos: bool, por: str,
    modo_duplex: object = SIN_ESPEJO,
) -> bytes:
    if not isinstance(carnet_ids, list):
        raise ValidationError('Indique la lista de carnets.', campo='carnet_ids')
    try:
        ids = [int(i) for i in carnet_ids]
    except (TypeError, ValueError):
        raise ValidationError('Los identificadores de carnet no son válidos.', campo='carnet_ids') from None
    modo = normalizar_modo(modo_duplex)
    return repo.generar_pdf_lote_carnets(ids, bool(marcar_impresos), por, modo)
