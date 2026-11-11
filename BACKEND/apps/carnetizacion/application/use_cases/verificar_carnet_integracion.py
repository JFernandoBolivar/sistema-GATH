"""Caso de uso: verificación de un carnet por un sistema integrado (SILOG). Puro."""
from apps.carnetizacion.domain.entities.verificacion_integracion import (
    VerificacionCarnet,
    normalizar_hash_carnet,
)
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion


def verificar_carnet_integracion_uc(repo: RepoCarnetizacion, security_hash: str | None) -> VerificacionCarnet:
    """Resuelve el hash del QR a una verificación; un hash mal formado es NO_REGISTRADO, sin tocar la BD."""
    normalizado = normalizar_hash_carnet(security_hash)
    if normalizado is None:
        return VerificacionCarnet(valido=False, estado='NO_REGISTRADO', mensaje='Carnet no encontrado en el sistema.')
    return repo.verificar_carnet_integracion(normalizado)
