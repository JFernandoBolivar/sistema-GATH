"""
Mappers de Familiares.
"""
from django.urls import reverse

from apps.familiares.domain.entities.documento_familiar import DocumentoFamiliar
from apps.familiares.domain.entities.familiar import Familiar
from apps.familiares.infrastructure.models.familiar_models import (
    EmployeefamilyModel,
    FamilyDocumentModel,
)
from apps.personal.infrastructure.mappers.mapper_personal import (
    formacion_a_dict,
    perfil_fisico_a_dict,
    salud_a_dict,
)
from apps.personal.infrastructure.models.expediente_models import (
    FormacionAcademicaModel,
    PerfilFisicoModel,
    PerfilSaludModel,
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
        perfil_salud=salud_a_dict(PerfilSaludModel.objects.filter(familiar=modelo).first()),
        perfil_fisico=perfil_fisico_a_dict(PerfilFisicoModel.objects.filter(familiar=modelo).first()),
        formacion_academica=(
            formacion_a_dict(fa) if (fa := FormacionAcademicaModel.objects.filter(familiar=modelo).first()) else None
        ),
    )


def documento_familiar_a_entidad(modelo: FamilyDocumentModel) -> DocumentoFamiliar:
    """
    `file` guarda solo la clave del objeto en SeaweedFS (no el `FileField`
    local de Django). `ruta_archivo` es la ruta de la API que sirve el archivo
    (autenticada y con permiso `familiares.ver`); nunca una URL de SeaweedFS.
    """
    ruta = ""
    if modelo.file:
        ruta = reverse(
            'familiares:documento-archivo',
            kwargs={'familiar_id': modelo.familymember_id, 'documento_id': modelo.pk},
        )
    return DocumentoFamiliar(
        id=modelo.pk,
        familiar_id=modelo.familymember_id,
        tipo_documento=modelo.document_type,
        ruta_archivo=ruta,
        fecha_subida=str(modelo.uploaded_at),
    )
