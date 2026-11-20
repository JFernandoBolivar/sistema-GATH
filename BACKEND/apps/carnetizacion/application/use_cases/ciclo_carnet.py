"""
Ciclo físico del carnet emitido (B-5): EMITIDO → IMPRESO → ENTREGADO, y ANULADO con motivo.
Las transiciones permitidas viven en `domain/value_objects/estado_fisico_carnet.py`.
"""
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from core.domain.exceptions import ValidationError


def marcar_impreso_uc(repo: RepoCarnetizacion, carnet_id: int, por: str) -> dict:
    return repo.marcar_carnet_impreso(carnet_id, por)


def marcar_entregado_uc(repo: RepoCarnetizacion, carnet_id: int, recibido_por: str, por: str) -> dict:
    if not str(recibido_por or '').strip():
        raise ValidationError('Indique quién recibe el carnet.', campo='recibido_por')
    return repo.marcar_carnet_entregado(carnet_id, recibido_por, por)


def anular_carnet_uc(repo: RepoCarnetizacion, carnet_id: int, motivo: str, por: str) -> dict:
    if not str(motivo or '').strip():
        raise ValidationError('Indique el motivo de la anulación.', campo='motivo')
    return repo.anular_carnet(carnet_id, motivo, por)
