"""Edición de los datos básicos permitidos de un pasivo (pasivos.editar)."""
from apps.pasivos.application.dtos.pasivos_dtos import PasivoDTO
from apps.pasivos.application.use_cases.listar_pasivos import pasivo_a_dto
from apps.pasivos.domain.ports.repo_pasivos import RepoPasivos


def actualizar_pasivo(repo: RepoPasivos, cedula: str, datos: dict) -> PasivoDTO:
    return pasivo_a_dto(repo.actualizar_datos_pasivo(cedula=cedula, datos=datos))
