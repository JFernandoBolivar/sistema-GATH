"""
Caso de uso para validar la autenticidad de un carnet institucional vía hash QR o ID.
"""
from apps.carnetizacion.application.dtos.carnetizacion_dtos import ValidacionCarnetDTO
from apps.carnetizacion.application.use_cases.listar_carnets import _carnet_a_dto
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion


def validar_carnet_por_hash(
    repo: RepoCarnetizacion, security_hash: str
) -> ValidacionCarnetDTO:
    carnet = repo.obtener_por_hash(security_hash)
    if not carnet:
        return ValidacionCarnetDTO(es_valido=False, mensaje="Carnet no registrado o hash inválido")
    if not carnet.activo:
        return ValidacionCarnetDTO(es_valido=False, carnet=_carnet_a_dto(carnet), mensaje="Carnet revocado o inactivo")
    return ValidacionCarnetDTO(es_valido=True, carnet=_carnet_a_dto(carnet), mensaje="Carnet auténtico y vigente")


def validar_carnet_por_id(
    repo: RepoCarnetizacion, carnet_id: int
) -> ValidacionCarnetDTO:
    carnet = repo.obtener_por_id(carnet_id)
    if not carnet:
        return ValidacionCarnetDTO(es_valido=False, mensaje="Carnet no encontrado")
    if not carnet.activo:
        return ValidacionCarnetDTO(es_valido=False, carnet=_carnet_a_dto(carnet), mensaje="Carnet revocado o inactivo")
    return ValidacionCarnetDTO(es_valido=True, carnet=_carnet_a_dto(carnet), mensaje="Carnet auténtico y vigente")
