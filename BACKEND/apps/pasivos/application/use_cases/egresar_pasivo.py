"""Egreso de un pasivo (fallecimiento) y alta de sobrevivientes en el mismo flujo."""
from apps.pasivos.application.dtos.pasivos_dtos import CrearSobrevivientesDTO, EgresarPasivoDTO
from apps.pasivos.application.use_cases.crear_sobrevivientes import ejecutar_creacion_sobrevivientes
from apps.pasivos.application.use_cases.listar_pasivos import pasivo_a_dto
from apps.pasivos.domain.ports.repo_pasivos import RepoPasivos


def listar_motivos_egreso_pasivo(repo: RepoPasivos) -> list[dict]:
    return repo.listar_motivos_egreso_pasivo()


def egresar_pasivo(repo: RepoPasivos, dto: EgresarPasivoDTO):
    """Marca el pasivo como EGRESADO y, si se indican, crea sus sobrevivientes."""
    pasivo = repo.egresar_pasivo(
        cedula=dto.cedula,
        motivo_id=dto.motivo_id,
        usuario_id=dto.usuario_id,
        fecha_egreso=dto.fecha_egreso,
    )
    resultados = []
    if dto.sobrevivientes_familiar_ids:
        resultados = ejecutar_creacion_sobrevivientes(
            repo,
            CrearSobrevivientesDTO(
                cedula_titular=dto.cedula,
                familiar_ids=dto.sobrevivientes_familiar_ids,
                usuario_id=dto.usuario_id,
            ),
        )
    return pasivo_a_dto(pasivo), resultados
