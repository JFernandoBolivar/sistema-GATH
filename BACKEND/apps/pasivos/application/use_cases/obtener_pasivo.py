"""
Caso de uso para consultar el detalle de un trabajador pasivo por cédula.
"""
from core.domain.exceptions import NotFoundError
from apps.pasivos.application.dtos.pasivos_dtos import PasivoDTO
from apps.pasivos.application.use_cases.listar_pasivos import pasivo_a_dto
from apps.pasivos.domain.ports.repo_pasivos import RepoPasivos


def obtener_pasivo_por_cedula(repo: RepoPasivos, cedula: str) -> PasivoDTO:
    entidad = repo.obtener_por_cedula(cedula)
    if not entidad:
        raise NotFoundError(f"Personal pasivo con cédula {cedula} no encontrado")
    return pasivo_a_dto(entidad)
