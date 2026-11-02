"""
Casos de uso para consultar familiares y documentos.
"""
from apps.familiares.application.dtos.familiares_dtos import (
    DocumentoFamiliarDTO,
    FamiliarDTO,
)
from apps.familiares.domain.entities.familiar import Familiar
from apps.familiares.domain.ports.repo_familiares import RepoFamiliares
from core.domain.exceptions import NotFoundError


def _familiar_a_dto(f: Familiar) -> FamiliarDTO:
    return FamiliarDTO(
        id=f.id,
        empleado_cedula=f.empleado_cedula,
        primer_nombre=f.primer_nombre,
        segundo_nombre=f.segundo_nombre,
        primer_apellido=f.primer_apellido,
        segundo_apellido=f.segundo_apellido,
        cedula_familiar=f.cedula_familiar,
        parentesco_id=f.parentesco_id,
        parentesco_nombre=f.parentesco_nombre,
        fecha_nacimiento=f.fecha_nacimiento,
        sexo_id=f.sexo_id,
        sexo_nombre=f.sexo_nombre,
        mismo_ente=f.mismo_ente,
        heredero=f.heredero,
        observaciones=f.observaciones,
        perfil_salud=f.perfil_salud,
        perfil_fisico=f.perfil_fisico,
        formacion_academica=f.formacion_academica,
    )


def listar_familiares_por_empleado(
    repo: RepoFamiliares, empleado_cedula: str
) -> list[FamiliarDTO]:
    entidades = repo.listar_por_empleado(empleado_cedula)
    return [_familiar_a_dto(e) for e in entidades]


def obtener_familiar_por_id(repo: RepoFamiliares, familiar_id: int) -> FamiliarDTO:
    familiar = repo.obtener_familiar(familiar_id)
    if familiar is None:
        raise NotFoundError('Familiar no encontrado.')
    return _familiar_a_dto(familiar)


def _documento_a_dto(d) -> DocumentoFamiliarDTO:
    return DocumentoFamiliarDTO(
        id=d.id,
        familiar_id=d.familiar_id,
        tipo_documento=d.tipo_documento,
        ruta_archivo=d.ruta_archivo,
        fecha_subida=d.fecha_subida,
    )


def listar_documentos_familiar(
    repo: RepoFamiliares, familiar_id: int
) -> list[DocumentoFamiliarDTO]:
    entidades = repo.listar_documentos(familiar_id)
    return [_documento_a_dto(d) for d in entidades]


def subir_documento_familiar(
    repo: RepoFamiliares, familiar_id: int, tipo_documento: str, clave: str
) -> DocumentoFamiliarDTO:
    entidad = repo.crear_documento(familiar_id=familiar_id, tipo_documento=tipo_documento, clave=clave)
    return _documento_a_dto(entidad)


def obtener_clave_documento_familiar(repo: RepoFamiliares, familiar_id: int, documento_id: int) -> str:
    clave = repo.obtener_clave_documento(familiar_id=familiar_id, documento_id=documento_id)
    if not clave:
        raise NotFoundError("Documento no encontrado.")
    return clave
