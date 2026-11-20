"""
Casos de uso de las solicitudes de carnet (decisión del 2026-11-20: el trabajador SOLICITA
desde Autogestión y Recursos Humanos revisa foto y datos y emite o rechaza).

La aprobación no tiene caso de uso propio: es la emisión normal (`emitir_carnet_y_pdf`) con la
solicitud enlazada, en la misma transacción (ver `CarnetGenerarView`).
"""
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from apps.carnetizacion.domain.value_objects import estado_solicitud_carnet as est
from core.domain.exceptions import ValidationError


def listar_solicitudes_carnet_uc(repo: RepoCarnetizacion, estado: str | None = None) -> list[dict]:
    estado = (estado or '').strip().upper() or None
    if estado == 'TODOS':
        estado = None
    if estado is not None and estado not in est.ESTADOS:
        raise ValidationError('Estado de solicitud no válido.', campo='estado')
    return repo.listar_solicitudes_carnet(estado)


def rechazar_solicitud_carnet_uc(
    repo: RepoCarnetizacion, solicitud_id: str, motivo: str, resuelta_por: str,
) -> dict:
    if not str(motivo or '').strip():
        raise ValidationError('Indique el motivo del rechazo.', campo='motivo')
    return repo.rechazar_solicitud_carnet(solicitud_id, motivo, resuelta_por)
