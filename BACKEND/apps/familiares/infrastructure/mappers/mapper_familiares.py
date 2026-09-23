"""
Mappers de Familiares.
"""
from apps.familiares.domain.entities.documento_familiar import DocumentoFamiliar
from apps.familiares.domain.entities.familiar import Familiar
from apps.familiares.infrastructure.models.familiar_models import (
    EmployeefamilyModel,
    FamilyDocumentModel,
)


def familiar_a_entidad(modelo: EmployeefamilyModel) -> Familiar:
    return Familiar(
        id=modelo.pk,
        empleado_cedula=str(modelo.employeecedula_id),
        cedula_familiar=modelo.cedulaFamiliar,
        primer_nombre=modelo.primer_nombre,
        segundo_nombre=modelo.segundo_nombre,
        primer_apellido=modelo.primer_apellido,
        segundo_apellido=modelo.segundo_apellido,
        parentesco_id=modelo.parentesco_id,
        parentesco_nombre=modelo.parentesco.descripcion_parentesco if modelo.parentesco else "",
        fecha_nacimiento=str(modelo.fechanacimiento),
        sexo_id=modelo.sexo_id,
        sexo_nombre=modelo.sexo.sexo if modelo.sexo else "",
        mismo_ente=modelo.mismo_ente,
        heredero=modelo.heredero,
        observaciones=modelo.observaciones,
    )


def documento_familiar_a_entidad(modelo: FamilyDocumentModel) -> DocumentoFamiliar:
    return DocumentoFamiliar(
        id=modelo.pk,
        familiar_id=modelo.familymember_id,
        tipo_documento=modelo.document_type,
        ruta_archivo=str(modelo.file.url) if modelo.file else "",
        fecha_subida=str(modelo.uploaded_at),
    )
