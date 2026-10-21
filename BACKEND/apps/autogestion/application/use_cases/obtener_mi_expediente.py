"""
Caso de uso: Obtener expediente completo del trabajador autenticado.
Consolida datos de personal (básicos, cargo/laboral, vivienda, salud, educación)
y cargas familiares (hijos, cónyuge, etc.).
"""
from dataclasses import dataclass
from core.domain.exceptions import NotFoundError
from apps.personal.domain.ports.repo_personal import RepoPersonal
from apps.personal.application.dtos.personal_dtos import EmpleadoDTO
from apps.personal.application.use_cases.listar_personal import _empleado_a_dto
from apps.familiares.domain.ports.repo_familiares import RepoFamiliares
from apps.familiares.application.dtos.familiares_dtos import FamiliarDTO
from apps.familiares.application.use_cases.listar_familiares import _familiar_a_dto


@dataclass(frozen=True)
class MiExpedienteDTO:
    empleado: EmpleadoDTO
    familiares: list[FamiliarDTO]


def obtener_mi_expediente(
    repo_personal: RepoPersonal,
    repo_familiares: RepoFamiliares,
    cedula: str,
) -> MiExpedienteDTO:
    if not cedula or not cedula.strip():
        raise NotFoundError("La cédula del trabajador es obligatoria.")

    entidad_empleado = repo_personal.obtener_por_cedula(cedula.strip())
    if not entidad_empleado:
        raise NotFoundError(f"No se encontró el expediente del trabajador con cédula {cedula}.")

    empleado_dto = _empleado_a_dto(entidad_empleado)
    familiares_entidades = repo_familiares.listar_por_empleado(cedula.strip())
    familiares_dtos = [_familiar_a_dto(f) for f in familiares_entidades]

    return MiExpedienteDTO(
        empleado=empleado_dto,
        familiares=familiares_dtos,
    )
