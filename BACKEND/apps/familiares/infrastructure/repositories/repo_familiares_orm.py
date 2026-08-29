"""
Repositorio ORM de Familiares (Reglas B4, B7).
"""
from core.domain.exceptions import NotFoundError
from apps.familiares.domain.entities.documento_familiar import DocumentoFamiliar
from apps.familiares.domain.entities.familiar import Familiar
from apps.familiares.infrastructure.mappers.mapper_familiares import (
    documento_familiar_a_entidad,
    familiar_a_entidad,
)
from apps.familiares.infrastructure.models.familiar_models import (
    EmployeefamilyModel,
    FamilyDocumentModel,
)


class RepoFamiliaresORM:
    def listar_por_empleado(self, empleado_cedula: str) -> list[Familiar]:
        qs = (
            EmployeefamilyModel.objects.select_related('parentesco', 'sexo')
            .filter(employeecedula_id=empleado_cedula)
            .order_by('-updatedat')
        )
        return [familiar_a_entidad(f) for f in qs]

    def obtener_familiar(self, familiar_id: int) -> Familiar | None:
        fila = (
            EmployeefamilyModel.objects.select_related('parentesco', 'sexo')
            .filter(pk=familiar_id)
            .first()
        )
        return familiar_a_entidad(fila) if fila else None

    def crear_familiar(self, familiar_datos: dict) -> Familiar:
        obj = EmployeefamilyModel.objects.create(
            employeecedula_id=familiar_datos['empleado_cedula'],
            primer_nombre=familiar_datos['primer_nombre'],
            segundo_nombre=familiar_datos.get('segundo_nombre'),
            primer_apellido=familiar_datos['primer_apellido'],
            segundo_apellido=familiar_datos.get('segundo_apellido'),
            cedulaFamiliar=familiar_datos.get('cedula_familiar'),
            parentesco_id=familiar_datos['parentesco_id'],
            fechanacimiento=familiar_datos['fecha_nacimiento'],
            sexo_id=familiar_datos['sexo_id'],
            mismo_ente=familiar_datos.get('mismo_ente', False),
            heredero=familiar_datos.get('heredero', False),
            observaciones=familiar_datos.get('observaciones'),
        )
        return self.obtener_familiar(obj.pk)

    def actualizar_familiar(self, familiar_id: int, datos: dict) -> Familiar:
        obj = EmployeefamilyModel.objects.filter(pk=familiar_id).first()
        if not obj:
            raise NotFoundError(f"Familiar con id {familiar_id} no encontrado")
        for k, v in datos.items():
            if hasattr(obj, k):
                setattr(obj, k, v)
        obj.save()
        return self.obtener_familiar(familiar_id)

    def eliminar_familiar(self, familiar_id: int) -> None:
        obj = EmployeefamilyModel.objects.filter(pk=familiar_id).first()
        if not obj:
            raise NotFoundError(f"Familiar con id {familiar_id} no encontrado")
        obj.delete()

    def listar_documentos(self, familiar_id: int) -> list[DocumentoFamiliar]:
        qs = FamilyDocumentModel.objects.filter(familymember_id=familiar_id).order_by('-uploaded_at')
        return [documento_familiar_a_entidad(d) for d in qs]
