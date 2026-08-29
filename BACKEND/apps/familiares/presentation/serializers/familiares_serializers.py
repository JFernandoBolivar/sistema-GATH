"""
Serializers de Presentación de Familiares.
"""
from rest_framework import serializers


class FamiliarSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    empleado_cedula = serializers.CharField(read_only=True)
    primer_nombre = serializers.CharField(read_only=True)
    segundo_nombre = serializers.CharField(read_only=True, allow_null=True)
    primer_apellido = serializers.CharField(read_only=True)
    segundo_apellido = serializers.CharField(read_only=True, allow_null=True)
    cedula_familiar = serializers.CharField(read_only=True, allow_null=True)
    parentesco_id = serializers.IntegerField(read_only=True)
    parentesco_nombre = serializers.CharField(read_only=True)
    fecha_nacimiento = serializers.CharField(read_only=True)
    sexo_id = serializers.IntegerField(read_only=True)
    sexo_nombre = serializers.CharField(read_only=True)
    mismo_ente = serializers.BooleanField(read_only=True)
    heredero = serializers.BooleanField(read_only=True)
    observaciones = serializers.CharField(read_only=True, allow_null=True)


class RegistrarFamiliarInputSerializer(serializers.Serializer):
    empleado_cedula = serializers.CharField(required=True, max_length=20)
    primer_nombre = serializers.CharField(required=True, max_length=150)
    segundo_nombre = serializers.CharField(required=False, allow_blank=True, max_length=150)
    primer_apellido = serializers.CharField(required=True, max_length=150)
    segundo_apellido = serializers.CharField(required=False, allow_blank=True, max_length=150)
    cedula_familiar = serializers.CharField(required=False, allow_blank=True, max_length=20)
    parentesco_id = serializers.IntegerField(required=True)
    fecha_nacimiento = serializers.DateField(required=True)
    sexo_id = serializers.IntegerField(required=True)
    mismo_ente = serializers.BooleanField(required=False, default=False)
    heredero = serializers.BooleanField(required=False, default=False)
    observaciones = serializers.CharField(required=False, allow_blank=True)


class DocumentoFamiliarSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    familiar_id = serializers.IntegerField(read_only=True)
    tipo_documento = serializers.CharField(read_only=True)
    ruta_archivo = serializers.CharField(read_only=True)
    fecha_subida = serializers.CharField(read_only=True)
