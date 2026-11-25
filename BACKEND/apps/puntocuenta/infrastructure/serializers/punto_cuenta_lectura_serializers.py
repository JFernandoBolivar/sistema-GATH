"""Serializadores de lectura y configuración operativa de Punto de Cuenta."""
from rest_framework import serializers


class PuntoCuentaSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    numero = serializers.CharField(allow_null=True)
    anio = serializers.IntegerField(allow_null=True)
    secuencia = serializers.IntegerField(allow_null=True)
    proceso = serializers.CharField(read_only=True)
    cargo_id = serializers.IntegerField()
    cargo_codigo = serializers.CharField(allow_null=True, required=False)
    cargo_nombre = serializers.CharField(allow_null=True, required=False)
    empleado_cedula = serializers.CharField()
    empleado_nombre = serializers.CharField(allow_null=True)
    dependencia_origen_id = serializers.IntegerField(allow_null=True)
    dependencia_origen_nombre = serializers.CharField(allow_null=True)
    dependencia_destino_id = serializers.IntegerField(allow_null=True)
    dependencia_destino_nombre = serializers.CharField(allow_null=True)
    oficina_origen_id = serializers.IntegerField(allow_null=True, required=False)
    oficina_origen = serializers.CharField(allow_null=True, required=False)
    oficina_destino_id = serializers.IntegerField(allow_null=True, required=False)
    oficina_destino = serializers.CharField(allow_null=True, required=False)
    division_origen_id = serializers.IntegerField(allow_null=True, required=False)
    division_origen = serializers.CharField(allow_null=True, required=False)
    division_destino_id = serializers.IntegerField(allow_null=True, required=False)
    division_destino = serializers.CharField(allow_null=True, required=False)
    motivo_id = serializers.IntegerField(allow_null=True)
    motivo_nombre = serializers.CharField(allow_null=True)
    usuario_id = serializers.IntegerField(allow_null=True)
    fecha = serializers.CharField()
    documento_generado = serializers.BooleanField()
    documento_generado_id = serializers.UUIDField(read_only=True, allow_null=True)


class ConfiguracionPuntoCuentaSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True, required=False, allow_null=True)
    generar = serializers.BooleanField()
    procesos_habilitados = serializers.DictField(child=serializers.BooleanField())
    version = serializers.IntegerField(read_only=True)
    actualizado_por_id = serializers.IntegerField(read_only=True, allow_null=True)
    updated_at = serializers.CharField(read_only=True, allow_null=True)


class ActualizarConfiguracionPuntoCuentaSerializer(serializers.Serializer):
    generar = serializers.BooleanField(required=False)
    procesos_habilitados = serializers.DictField(child=serializers.BooleanField(), required=False)

    CAMPOS_RETIRADOS = frozenset({
        'titulo', 'encabezado', 'cuerpo', 'firmas', 'mostrar_nivel', 'plantillas_procesos',
        'presentado_a', 'cargo_presentado_a', 'presentado_por', 'cargo_presentado_por',
        'unidad', 'asunto', 'exposicion', 'propuesta', 'base_legal', 'observaciones_texto',
        'incluir_presentado_a', 'incluir_presentado_por', 'incluir_asunto', 'incluir_exposicion',
        'incluir_propuesta', 'incluir_base_legal', 'incluir_decision', 'incluir_observaciones',
        'incluir_tabla_resumen', 'incluir_firmas',
    })

    def validate(self, attrs):
        retirados = sorted(set(self.initial_data) & self.CAMPOS_RETIRADOS)
        if retirados:
            raise serializers.ValidationError({
                campo: 'Este campo se edita en el diseñador de documentos, no en la configuración del Punto de Cuenta.'
                for campo in retirados
            })
        return attrs
