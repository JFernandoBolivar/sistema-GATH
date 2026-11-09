"""
Serializers de Presentación de Carnetización (Regla B5, O44 - E3).
"""
from core.domain.limites_texto import OBSERVACION_MIN, OBSERVACION_MAX, mensajes_texto
from rest_framework import serializers


class CarnetSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    empleado_cedula = serializers.CharField(read_only=True)
    empleado_nombres = serializers.CharField(read_only=True)
    empleado_apellidos = serializers.CharField(read_only=True)
    security_hash = serializers.CharField(read_only=True)
    fecha_emision = serializers.CharField(read_only=True)
    motivo_id = serializers.IntegerField(read_only=True)
    motivo_nombre = serializers.CharField(read_only=True)
    activo = serializers.BooleanField(read_only=True)
    observaciones = serializers.CharField(read_only=True, allow_null=True)
    plantilla_id = serializers.CharField(read_only=True, allow_null=True)
    plantilla_version = serializers.IntegerField(read_only=True, allow_null=True)
    plantilla_snapshot = serializers.JSONField(read_only=True, allow_null=True)


class EmitirCarnetInputSerializer(serializers.Serializer):
    empleado_cedula = serializers.CharField(
        required=True, min_length=5, max_length=20, trim_whitespace=True
    )
    motivo_id = serializers.IntegerField(required=True)
    observaciones = serializers.CharField(
        required=False, allow_blank=True, min_length=OBSERVACION_MIN, max_length=OBSERVACION_MAX, trim_whitespace=True,
        error_messages=mensajes_texto('Las observaciones', OBSERVACION_MIN, OBSERVACION_MAX),
    )
    plantilla_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class PlantillaCarnetSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    imagen_url = serializers.CharField(read_only=True)
    activo = serializers.BooleanField(read_only=True)
    creado = serializers.CharField(read_only=True)


class TipoCredencialSerializer(serializers.Serializer):
    codigo = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    descripcion = serializers.CharField(read_only=True)
    ancho_mm = serializers.FloatField(read_only=True)
    alto_mm = serializers.FloatField(read_only=True)
    orientacion = serializers.CharField(read_only=True)
    grupo = serializers.CharField(read_only=True)
    activo = serializers.BooleanField(read_only=True)
    orden = serializers.IntegerField(read_only=True)


class PlantillaMotorDetalleSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    codigo_tipo = serializers.CharField(read_only=True)
    ancho_mm = serializers.FloatField(read_only=True)
    alto_mm = serializers.FloatField(read_only=True)
    orientacion = serializers.CharField(read_only=True)
    regla_criterio = serializers.CharField(read_only=True)
    regla_valor = serializers.CharField(read_only=True)
    estado = serializers.CharField(read_only=True)
    activa = serializers.BooleanField(read_only=True)
    version = serializers.IntegerField(read_only=True)
    definicion = serializers.JSONField(read_only=True)
    creado = serializers.CharField(read_only=True)
    actualizado = serializers.CharField(read_only=True)
    plantilla_raiz_id = serializers.CharField(read_only=True, allow_null=True)
    creado_por = serializers.CharField(read_only=True, allow_null=True)
    descripcion = serializers.CharField(read_only=True)
    imagen_url = serializers.CharField(read_only=True)


class CrearPlantillaBorradorInputSerializer(serializers.Serializer):
    nombre = serializers.CharField(required=True, min_length=2, max_length=150, trim_whitespace=True)
    codigo_tipo = serializers.CharField(required=False, default='trabajador', max_length=50)
    definicion = serializers.JSONField(required=False, default=dict)
    ancho_mm = serializers.FloatField(required=False, default=54.0)
    alto_mm = serializers.FloatField(required=False, default=85.6)
    orientacion = serializers.ChoiceField(choices=['vertical', 'horizontal'], default='vertical')
    regla_criterio = serializers.CharField(required=False, default='todos', max_length=50)
    regla_valor = serializers.CharField(required=False, default='*', max_length=100)
    descripcion = serializers.CharField(required=False, default='', allow_blank=True)


class ActualizarPlantillaBorradorInputSerializer(serializers.Serializer):
    nombre = serializers.CharField(required=False, min_length=2, max_length=150, trim_whitespace=True)
    definicion = serializers.JSONField(required=False)
    ancho_mm = serializers.FloatField(required=False)
    alto_mm = serializers.FloatField(required=False)
    orientacion = serializers.ChoiceField(choices=['vertical', 'horizontal'], required=False)
    regla_criterio = serializers.CharField(required=False, max_length=50)
    regla_valor = serializers.CharField(required=False, max_length=100)
    descripcion = serializers.CharField(required=False, allow_blank=True)


class PublicarPlantillaInputSerializer(serializers.Serializer):
    activar = serializers.BooleanField(required=False, default=True)


class ValidacionCarnetSerializer(serializers.Serializer):
    es_valido = serializers.BooleanField(read_only=True)
    mensaje = serializers.CharField(read_only=True)
    carnet = CarnetSerializer(read_only=True, allow_null=True)


class ElementoBibliotecaSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    categoria = serializers.CharField(read_only=True)
    archivo_url = serializers.CharField(read_only=True)
    tamano_bytes = serializers.IntegerField(read_only=True)
    mime_type = serializers.CharField(read_only=True)
    ancho_px = serializers.IntegerField(read_only=True, allow_null=True)
    alto_px = serializers.IntegerField(read_only=True, allow_null=True)
    creado = serializers.CharField(read_only=True)
    creado_por = serializers.CharField(read_only=True, allow_null=True)
    descripcion = serializers.CharField(read_only=True)


class SubirElementoBibliotecaInputSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=150, min_length=2)
    categoria = serializers.ChoiceField(choices=['logo', 'firma', 'imagen'])
    archivo = serializers.FileField()
    descripcion = serializers.CharField(required=False, default='', allow_blank=True)


class CampoCredencialSerializer(serializers.Serializer):
    codigo = serializers.CharField(read_only=True)
    etiqueta = serializers.CharField(read_only=True)
    grupo = serializers.CharField(read_only=True)
    tipo_credencial = serializers.CharField(read_only=True)
    sensible = serializers.BooleanField(read_only=True)
    es_personalizado = serializers.BooleanField(read_only=True)
    descripcion = serializers.CharField(read_only=True)
    valor_ejemplo = serializers.CharField(read_only=True)


class CrearCampoPersonalizadoInputSerializer(serializers.Serializer):
    codigo = serializers.SlugField(max_length=50)
    etiqueta = serializers.CharField(max_length=100, min_length=2)
    grupo = serializers.CharField(max_length=50, required=False, default='personalizado')
    tipo_credencial = serializers.CharField(max_length=50, required=False, default='todos')
    sensible = serializers.BooleanField(required=False, default=False)
    descripcion = serializers.CharField(required=False, default='', allow_blank=True)
    valor_ejemplo = serializers.CharField(required=False, default='', allow_blank=True)


class FichaQrSerializer(serializers.Serializer):
    es_valido = serializers.BooleanField(read_only=True)
    estado = serializers.CharField(read_only=True)
    mensaje = serializers.CharField(read_only=True)
    security_hash = serializers.CharField(read_only=True, allow_null=True)
    nivel_acceso = serializers.CharField(read_only=True)
    datos = serializers.DictField(read_only=True, allow_null=True)
    salud_disponible = serializers.BooleanField(read_only=True)
    fecha_emision = serializers.CharField(read_only=True, allow_null=True)
    fecha_vencimiento = serializers.CharField(read_only=True, allow_null=True)


class PreferenciasPrivacidadInputSerializer(serializers.Serializer):
    preferencias = serializers.DictField(
        child=serializers.CharField(),
        required=True,
    )
