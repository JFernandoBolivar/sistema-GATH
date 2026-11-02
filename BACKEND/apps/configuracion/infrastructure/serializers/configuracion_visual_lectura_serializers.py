"""
Serializer de lectura de Configuración Visual — el caso de uso devuelve un
DTO (dataclass), no un modelo ORM, por eso es `serializers.Serializer` plano.

Las 3 `_url` son URLs prefirmadas de SeaweedFS (D-01), calculadas en la vista
a partir de las claves (I/O permitido en `presentation/`, igual que
`EmpleadoFotoView`) — nunca viajan como parte de la entidad/DTO de dominio,
que solo conoce las claves. `None` si el campo correspondiente no tiene
imagen configurada (el consumidor debe usar su propio asset de respaldo).
"""
from rest_framework import serializers


class ConfiguracionVisualSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    tipo_cintillo = serializers.ChoiceField(choices=['GENERICO', 'FIJO'])
    nombre_empresa = serializers.CharField(allow_null=True)
    logo_principal_clave = serializers.CharField(allow_null=True)
    logo_principal_url = serializers.CharField(allow_null=True, required=False)
    logo_secundario_clave = serializers.CharField(allow_null=True)
    logo_secundario_url = serializers.CharField(allow_null=True, required=False)
    cintillo_pie_clave = serializers.CharField(allow_null=True)
    cintillo_pie_url = serializers.CharField(allow_null=True, required=False)
    color_fondo = serializers.CharField(allow_null=True)
    actualizado_por_id = serializers.IntegerField(allow_null=True)
    actualizado_en = serializers.CharField(allow_null=True)
