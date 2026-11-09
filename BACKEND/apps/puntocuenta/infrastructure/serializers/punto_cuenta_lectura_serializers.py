"""
Serializadores de Punto de Cuenta y su Configuración (Reglas B4, B7).
"""
from rest_framework import serializers

from apps.puntocuenta.domain.services.variables_plantilla import (
    VARIABLES_PERMITIDAS,
    validar_variables_texto,
)


CAMPOS_CON_VARIABLES = (
    'titulo',
    'encabezado',
    'cuerpo',
    'asunto',
    'exposicion',
    'propuesta',
    'base_legal',
    'presentado_a',
    'cargo_presentado_a',
    'presentado_por',
    'cargo_presentado_por',
    'unidad',
    'observaciones_texto',
)


def _validar_variables_de_campos(datos: dict) -> None:
    for campo in CAMPOS_CON_VARIABLES:
        valor = datos.get(campo)
        if isinstance(valor, str) and valor:
            desconocidas = validar_variables_texto(valor)
            if desconocidas:
                permitidas_str = ', '.join(f"{{{v}}}" for v in sorted(VARIABLES_PERMITIDAS))
                desconocidas_str = ', '.join(f"{{{v}}}" for v in desconocidas)
                raise serializers.ValidationError({
                    campo: f"Variable(s) no válida(s): {desconocidas_str}. Las variables permitidas son: {permitidas_str}."
                })


class PlantillaProcesoSerializer(serializers.Serializer):
    personalizado = serializers.BooleanField(default=False)
    titulo = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    encabezado = serializers.CharField(allow_blank=True, required=False, default='')
    cuerpo = serializers.CharField(allow_blank=True, required=False, default='')
    presentado_a = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    cargo_presentado_a = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    presentado_por = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    cargo_presentado_por = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    unidad = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    asunto = serializers.CharField(allow_blank=True, required=False, default='')
    exposicion = serializers.CharField(allow_blank=True, required=False, default='')
    propuesta = serializers.CharField(allow_blank=True, required=False, default='')
    base_legal = serializers.CharField(allow_blank=True, required=False, default='')
    observaciones_texto = serializers.CharField(allow_blank=True, required=False, default='')
    incluir_presentado_a = serializers.BooleanField(required=False, default=True)
    incluir_presentado_por = serializers.BooleanField(required=False, default=True)
    incluir_asunto = serializers.BooleanField(required=False, default=True)
    incluir_exposicion = serializers.BooleanField(required=False, default=True)
    incluir_propuesta = serializers.BooleanField(required=False, default=True)
    incluir_base_legal = serializers.BooleanField(required=False, default=True)
    incluir_decision = serializers.BooleanField(required=False, default=True)
    incluir_observaciones = serializers.BooleanField(required=False, default=True)
    incluir_tabla_resumen = serializers.BooleanField(required=False, default=False)
    incluir_firmas = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs):
        _validar_variables_de_campos(attrs)
        return attrs



class PuntoCuentaSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    numero = serializers.CharField(allow_null=True)
    anio = serializers.IntegerField(allow_null=True)
    secuencia = serializers.IntegerField(allow_null=True)
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


class FirmaItemSerializer(serializers.Serializer):
    cargo = serializers.CharField(max_length=150, allow_blank=True)
    nombre = serializers.CharField(max_length=150, allow_blank=True, required=False, default='')


class ConfiguracionPuntoCuentaSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True, required=False)
    generar = serializers.BooleanField()
    procesos_habilitados = serializers.DictField(child=serializers.BooleanField())
    titulo = serializers.CharField(max_length=200)
    encabezado = serializers.CharField(allow_blank=True)
    cuerpo = serializers.CharField(allow_blank=True)
    presentado_a = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    cargo_presentado_a = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    presentado_por = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    cargo_presentado_por = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    unidad = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    asunto = serializers.CharField(allow_blank=True, required=False, default='')
    exposicion = serializers.CharField(allow_blank=True, required=False, default='')
    propuesta = serializers.CharField(allow_blank=True, required=False, default='')
    base_legal = serializers.CharField(allow_blank=True, required=False, default='')
    observaciones_texto = serializers.CharField(allow_blank=True, required=False, default='')
    incluir_presentado_a = serializers.BooleanField(required=False, default=True)
    incluir_presentado_por = serializers.BooleanField(required=False, default=True)
    incluir_asunto = serializers.BooleanField(required=False, default=True)
    incluir_exposicion = serializers.BooleanField(required=False, default=True)
    incluir_propuesta = serializers.BooleanField(required=False, default=True)
    incluir_base_legal = serializers.BooleanField(required=False, default=True)
    incluir_decision = serializers.BooleanField(required=False, default=True)
    incluir_observaciones = serializers.BooleanField(required=False, default=True)
    incluir_tabla_resumen = serializers.BooleanField(required=False, default=False)
    incluir_firmas = serializers.BooleanField(required=False, default=True)
    firmas = FirmaItemSerializer(many=True)
    mostrar_nivel = serializers.BooleanField()
    plantillas_procesos = serializers.DictField(child=PlantillaProcesoSerializer(), required=False)
    variables_disponibles = serializers.ListField(child=serializers.DictField(), read_only=True, required=False)
    version = serializers.IntegerField(read_only=True)
    actualizado_por_id = serializers.IntegerField(read_only=True, allow_null=True)
    updated_at = serializers.CharField(read_only=True, allow_null=True)


class ActualizarConfiguracionPuntoCuentaSerializer(serializers.Serializer):
    generar = serializers.BooleanField(required=False)
    procesos_habilitados = serializers.DictField(child=serializers.BooleanField(), required=False)
    titulo = serializers.CharField(max_length=200, required=False)
    encabezado = serializers.CharField(allow_blank=True, required=False)
    cuerpo = serializers.CharField(allow_blank=True, required=False)
    presentado_a = serializers.CharField(max_length=200, allow_blank=True, required=False)
    cargo_presentado_a = serializers.CharField(max_length=200, allow_blank=True, required=False)
    presentado_por = serializers.CharField(max_length=200, allow_blank=True, required=False)
    cargo_presentado_por = serializers.CharField(max_length=200, allow_blank=True, required=False)
    unidad = serializers.CharField(max_length=200, allow_blank=True, required=False)
    asunto = serializers.CharField(allow_blank=True, required=False)
    exposicion = serializers.CharField(allow_blank=True, required=False)
    propuesta = serializers.CharField(allow_blank=True, required=False)
    base_legal = serializers.CharField(allow_blank=True, required=False)
    observaciones_texto = serializers.CharField(allow_blank=True, required=False)
    incluir_presentado_a = serializers.BooleanField(required=False)
    incluir_presentado_por = serializers.BooleanField(required=False)
    incluir_asunto = serializers.BooleanField(required=False)
    incluir_exposicion = serializers.BooleanField(required=False)
    incluir_propuesta = serializers.BooleanField(required=False)
    incluir_base_legal = serializers.BooleanField(required=False)
    incluir_decision = serializers.BooleanField(required=False)
    incluir_observaciones = serializers.BooleanField(required=False)
    incluir_tabla_resumen = serializers.BooleanField(required=False)
    incluir_firmas = serializers.BooleanField(required=False)
    firmas = FirmaItemSerializer(many=True, required=False)
    mostrar_nivel = serializers.BooleanField(required=False)
    plantillas_procesos = serializers.DictField(child=PlantillaProcesoSerializer(), required=False)
    proceso = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate(self, attrs):
        _validar_variables_de_campos(attrs)
        return attrs
