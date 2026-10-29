"""
Serialización de las respuestas del portal del trabajador. Vive en
`infrastructure/` porque reutiliza los serializers de personal, familiares y
carnetización (B16: solo esa capa puede cruzar módulos).
"""
from apps.carnetizacion.presentation.serializers.carnetizacion_serializers import CarnetSerializer
from apps.familiares.presentation.serializers.familiares_serializers import FamiliarSerializer
from apps.personal.presentation.serializers.personal_serializers import EmpleadoSerializer


def serializar_mi_expediente(dto) -> dict:
    carnet_activo = dto.carnet_activo
    return {
        'empleado': EmpleadoSerializer(dto.empleado).data,
        'familiares': FamiliarSerializer(dto.familiares, many=True).data,
        'carnet_activo': CarnetSerializer(carnet_activo).data if carnet_activo else None,
        'carnets': CarnetSerializer(dto.carnets, many=True).data,
        'motivos_carnet': dto.motivos_carnet,
    }


def serializar_carnet(carnet) -> dict:
    return CarnetSerializer(carnet).data
