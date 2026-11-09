"""Serializers DRF para el módulo de eventos, invitados y control de entrada (O45-B)."""
from rest_framework import serializers


class EventoCategoriaSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    evento_id = serializers.CharField(read_only=True)
    nombre = serializers.CharField(max_length=100)
    color_primario = serializers.CharField(max_length=20, default="#0B4A9E")
    color_acento = serializers.CharField(max_length=20, default="#F59E0B")
    orden = serializers.IntegerField(default=1)
    plantilla_id = serializers.CharField(required=False, allow_null=True, default=None)


class EventoZonaSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    evento_id = serializers.CharField(read_only=True)
    nombre = serializers.CharField(max_length=100)
    codigo = serializers.CharField(max_length=50, default="")
    orden = serializers.IntegerField(default=1)


class EventoSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    nombre = serializers.CharField(max_length=200)
    lugar = serializers.CharField(max_length=250)
    fecha_inicio = serializers.CharField()
    fecha_fin = serializers.CharField()
    descripcion = serializers.CharField(required=False, allow_blank=True, default="")
    estado = serializers.CharField(default="activo")
    plantilla_id = serializers.CharField(required=False, allow_null=True, default=None)
    creado_por_id = serializers.IntegerField(read_only=True, allow_null=True)
    created_at = serializers.CharField(read_only=True, allow_null=True)
    updated_at = serializers.CharField(read_only=True, allow_null=True)
    categorias = EventoCategoriaSerializer(many=True, read_only=True)
    zonas = EventoZonaSerializer(many=True, read_only=True)
    total_invitados = serializers.IntegerField(read_only=True, default=0)
    total_entraron = serializers.IntegerField(read_only=True, default=0)


class EventoCrearSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=200)
    lugar = serializers.CharField(max_length=250)
    fecha_inicio = serializers.DateTimeField()
    fecha_fin = serializers.DateTimeField()
    descripcion = serializers.CharField(required=False, allow_blank=True, default="")
    plantilla_id = serializers.CharField(required=False, allow_null=True, default=None)
    categorias = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    zonas = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class EventoActualizarSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=200, required=False)
    lugar = serializers.CharField(max_length=250, required=False)
    fecha_inicio = serializers.DateTimeField(required=False)
    fecha_fin = serializers.DateTimeField(required=False)
    descripcion = serializers.CharField(required=False, allow_blank=True)
    estado = serializers.CharField(required=False)
    plantilla_id = serializers.CharField(required=False, allow_null=True)


class EventoInvitadoSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    evento_id = serializers.CharField()
    nombre_completo = serializers.CharField(max_length=150)
    categoria_id = serializers.CharField()
    zona_id = serializers.CharField()
    categoria_nombre = serializers.CharField(read_only=True, default="")
    zona_nombre = serializers.CharField(read_only=True, default="")
    documento_identidad = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    organizacion = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    correo = serializers.EmailField(required=False, allow_blank=True, default="")
    telefono = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    mesa = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    codigo_credencial = serializers.CharField(read_only=True, default="")
    security_hash = serializers.CharField(read_only=True, default="")
    es_acompanante = serializers.BooleanField(default=False)
    trabajador_titular_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    trabajador_titular_nombre = serializers.CharField(read_only=True, allow_null=True)
    estado = serializers.CharField(default="registrado")
    fecha_emision = serializers.CharField(read_only=True, allow_null=True)
    fecha_ingreso = serializers.CharField(read_only=True, allow_null=True)
    hora_ingreso_formateada = serializers.CharField(read_only=True, allow_null=True)
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")
    created_at = serializers.CharField(read_only=True, allow_null=True)


class InvitadoCrearSerializer(serializers.Serializer):
    evento_id = serializers.CharField()
    nombre_completo = serializers.CharField(max_length=150)
    categoria_id = serializers.CharField()
    zona_id = serializers.CharField()
    documento_identidad = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    organizacion = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    correo = serializers.EmailField(required=False, allow_blank=True, default="")
    telefono = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    mesa = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    es_acompanante = serializers.BooleanField(required=False, default=False)
    trabajador_titular_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")


class InvitadoImportarFilaSerializer(serializers.Serializer):
    fila = serializers.IntegerField(default=1)
    nombre_completo = serializers.CharField(max_length=150)
    categoria_nombre = serializers.CharField(max_length=100)
    zona_nombre = serializers.CharField(max_length=100)
    documento_identidad = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    organizacion = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    correo = serializers.EmailField(required=False, allow_blank=True, default="")
    telefono = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    mesa = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    valida = serializers.BooleanField(default=True)
    error = serializers.CharField(required=False, allow_blank=True, default="")


class ResumenImportacionSerializer(serializers.Serializer):
    total_filas = serializers.IntegerField()
    filas_validas = serializers.IntegerField()
    filas_invalidas = serializers.IntegerField()
    filas = InvitadoImportarFilaSerializer(many=True)


class ImportarInvitadosRequestSerializer(serializers.Serializer):
    filas = InvitadoImportarFilaSerializer(many=True)
    confirmar = serializers.BooleanField(default=False)


class EmitirCredencialesLoteSerializer(serializers.Serializer):
    invitados_ids = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


class EnviarCredencialesCorreoSerializer(serializers.Serializer):
    invitados_ids = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


class CheckInRequestSerializer(serializers.Serializer):
    codigo_o_hash = serializers.CharField(max_length=128)
    evento_id = serializers.CharField(required=False, allow_null=True, default=None)
    zona_id = serializers.CharField(required=False, allow_null=True, default=None)


class CheckInResponseSerializer(serializers.Serializer):
    resultado = serializers.CharField()  # ACCESO_PERMITIDO, YA_INGRESO, NO_VALIDA
    mensaje = serializers.CharField()
    invitado_id = serializers.CharField(allow_null=True)
    nombre_completo = serializers.CharField(allow_null=True)
    documento_identidad = serializers.CharField(allow_null=True)
    organizacion = serializers.CharField(allow_null=True)
    categoria_nombre = serializers.CharField(allow_null=True)
    zona_nombre = serializers.CharField(allow_null=True)
    mesa = serializers.CharField(allow_null=True)
    codigo_credencial = serializers.CharField(allow_null=True)
    hora_ingreso_formateada = serializers.CharField(allow_null=True)


class PanelEventoSerializer(serializers.Serializer):
    evento_id = serializers.CharField()
    nombre_evento = serializers.CharField()
    lugar = serializers.CharField()
    fecha_inicio = serializers.CharField()
    fecha_fin = serializers.CharField()
    estado = serializers.CharField()
    total_invitados = serializers.IntegerField()
    credenciales_emitidas = serializers.IntegerField()
    entraron = serializers.IntegerField()
    faltan = serializers.IntegerField()
    porcentaje_asistencia = serializers.FloatField()
    por_categoria = serializers.DictField(child=serializers.IntegerField())
    por_zona = serializers.DictField(child=serializers.IntegerField())
