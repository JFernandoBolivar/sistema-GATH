"""Alta directa de personal pasivo (jubilado/pensionado) con movimiento de ingreso."""
from apps.pasivos.application.dtos.pasivos_dtos import RegistrarPasivoDirectoDTO
from apps.pasivos.application.use_cases.listar_pasivos import pasivo_a_dto
from apps.pasivos.domain.ports.repo_pasivos import RepoPasivos


def registrar_pasivo_directo(
    repo: RepoPasivos,
    dto: RegistrarPasivoDirectoDTO,
):
    return pasivo_a_dto(
        repo.registrar_pasivo_directo(
            datos=dto.datos,
            tipo_nomina_id=dto.tipo_nomina_id,
            usuario_id=dto.usuario_id,
        )
    )
