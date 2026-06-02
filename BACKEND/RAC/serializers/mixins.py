"""
Mixins reutilizables para serializers de la app RAC.
"""
from ..models.personal_models import contratos
from .catalogs_serializers import ContratoSerializer


class ContratoMixin:
    """
    Mixin para exponer los contratos de un empleado en cualquier serializer
    que trabaje sobre el modelo Employee.

    Centraliza la lógica de get_contrato en un único lugar, eliminando la
    duplicación que existía en EmployeeListSerializer, EmployeeDetailSerializer
    y EmployeePasiveDetailSerializer.
    """

    def get_contrato(self, obj):
        contratos_qs = contratos.objects.filter(
            antecedente_id__empleado_id=obj
        ).select_related('antecedente_id', 'politica_id', 'estatus_id')
        return ContratoSerializer(contratos_qs, many=True).data
