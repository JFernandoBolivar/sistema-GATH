"""
Implementación ORM del lector de validación de familiares (S5-01).

Mismas consultas que hacía el serializer de entrada, ahora en infrastructure.
"""
from apps.familiares.application.use_cases.validaciones_familiar import (
    ReglaParentescoFamiliar,
    regla_por_defecto,
)
from apps.familiares.domain.ports.lector_validacion_familiar import (
    ParentescoDeFamiliar,
    TitularDeFamiliar,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.familiares.infrastructure.modelos_externos import (
    EmployeeModel,
    ParentescoModel,
    ReglaParentescoModel,
    SexoModel,
)


class LectorValidacionFamiliarORM:
    """Implementa el puerto `LectorValidacionFamiliar`."""

    def titular(self, empleado_cedula: str) -> TitularDeFamiliar | None:
        empleado = EmployeeModel.objects.filter(cedulaidentidad=empleado_cedula).first()
        if empleado is None:
            return None
        return TitularDeFamiliar(
            cedula=str(empleado.cedulaidentidad),
            fecha_nacimiento=empleado.fecha_nacimiento,
        )

    def parentesco(self, parentesco_id: int) -> ParentescoDeFamiliar | None:
        fila = ParentescoModel.objects.filter(pk=parentesco_id).first()
        if fila is None:
            return None
        return ParentescoDeFamiliar(
            id=fila.pk,
            descripcion=fila.descripcion_parentesco,
            aplica_familiar=bool(getattr(fila, 'aplica_familiar', True)),
        )

    def regla_de_parentesco(self, parentesco: ParentescoDeFamiliar) -> ReglaParentescoFamiliar:
        """Regla configurada o el respaldo para un parentesco legado."""
        guardada = ReglaParentescoModel.objects.filter(parentesco_id=parentesco.id).first()
        if guardada is None:
            return regla_por_defecto(parentesco.descripcion)
        return ReglaParentescoFamiliar(
            descripcion=parentesco.descripcion,
            es_hijo=guardada.es_hijo,
            menor_a_cargo=guardada.menor_a_cargo,
            sin_cedula_hasta_edad=guardada.sin_cedula_hasta_edad,
            edad_minima=guardada.edad_minima,
            diferencia_minima=guardada.diferencia_minima,
            diferencia_tipo=guardada.diferencia_tipo,
            sexo_permitido=guardada.sexo_permitido,
            soporte_sugerido=guardada.soporte_sugerido,
            activo=guardada.activo,
        )

    def sexo_nombre(self, sexo_id: int) -> str | None:
        return SexoModel.objects.filter(pk=sexo_id).values_list('sexo', flat=True).first()

    def cedulas_familiares(self, empleado_cedula: str, excluir_id: int | None) -> set[str]:
        qs = EmployeefamilyModel.objects.filter(
            employeecedula_id=empleado_cedula,
        ).exclude(pk=excluir_id)
        return {str(c) for c in qs.values_list('cedulaFamiliar', flat=True) if c}

    def existe_heredero(self, empleado_cedula: str, excluir_id: int | None) -> bool:
        qs = EmployeefamilyModel.objects.filter(
            employeecedula_id=empleado_cedula, heredero=True,
        )
        if excluir_id is not None:
            qs = qs.exclude(pk=excluir_id)
        return qs.exists()
