"""
Serializers de lectura del expediente compartidos entre módulos.

Un `pasivo` también es un `Employee` (su expediente tiene exactamente la misma
forma), por eso estos serializers de presentación viven en `core/` y no en
`apps.personal`: son contrato de lectura transversal (B16, patrón R-02 del
plan — el código compartido se aloja en el kernel, no en un módulo).
"""
from rest_framework import serializers


class DatosViviendaLecturaSerializer(serializers.Serializer):
    estado_id = serializers.IntegerField(allow_null=True)
    municipio_id = serializers.IntegerField(allow_null=True)
    parroquia_id = serializers.IntegerField(allow_null=True)
    direccion_exacta = serializers.CharField(allow_null=True)
    condicion_vivienda_id = serializers.IntegerField(allow_null=True)
    codigo_postal_id = serializers.IntegerField(allow_null=True)


class PerfilSaludLecturaSerializer(serializers.Serializer):
    grupo_sanguineo_id = serializers.IntegerField(allow_null=True)
    alergias = serializers.ListField(child=serializers.IntegerField(), required=False)
    patologias_cronicas = serializers.ListField(child=serializers.IntegerField(), required=False)
    discapacidades = serializers.ListField(child=serializers.IntegerField(), required=False)


class PerfilFisicoLecturaSerializer(serializers.Serializer):
    talla_camisa_id = serializers.IntegerField(allow_null=True)
    talla_pantalon_id = serializers.IntegerField(allow_null=True)
    talla_zapatos_id = serializers.IntegerField(allow_null=True)
    talla_chaqueta_id = serializers.IntegerField(allow_null=True)


class FormacionComplementariaLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    capacitacion_id = serializers.IntegerField(allow_null=True)
    institucion_id = serializers.IntegerField(allow_null=True)
    fecha_inicio = serializers.CharField(allow_null=True)
    fecha_fin = serializers.CharField(allow_null=True)
    dias_completados = serializers.CharField(allow_null=True)
    horas_completadas = serializers.CharField(allow_null=True)
    procedencia_id = serializers.IntegerField(allow_null=True)
    grupo_id = serializers.IntegerField(allow_null=True)


class FormacionAcademicaLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nivel_academico_id = serializers.IntegerField(allow_null=True)
    carrera_id = serializers.IntegerField(allow_null=True)
    mencion_id = serializers.IntegerField(allow_null=True)
    institucion_id = serializers.IntegerField(allow_null=True)


class ContactoEmergenciaLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombres = serializers.CharField()
    apellidos = serializers.CharField()
    telefono = serializers.CharField(allow_null=True)
    relacion_id = serializers.IntegerField(allow_null=True)


class AntecedenteServicioLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    organismo_id = serializers.IntegerField(allow_null=True)
    fecha_ingreso = serializers.CharField(allow_null=True)
    fecha_egreso = serializers.CharField(allow_null=True)


class ContratoLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    n_contrato = serializers.CharField()
    fecha_culminacion = serializers.CharField(allow_null=True)
    politica_id = serializers.IntegerField(allow_null=True)
    estatus_id = serializers.IntegerField(allow_null=True)
    es_fijo = serializers.BooleanField()
