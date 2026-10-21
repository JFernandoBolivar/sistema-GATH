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
    estado_nombre = serializers.CharField(allow_null=True, required=False)
    municipio_id = serializers.IntegerField(allow_null=True)
    municipio_nombre = serializers.CharField(allow_null=True, required=False)
    parroquia_id = serializers.IntegerField(allow_null=True)
    parroquia_nombre = serializers.CharField(allow_null=True, required=False)
    direccion_exacta = serializers.CharField(allow_null=True)
    condicion_vivienda_id = serializers.IntegerField(allow_null=True)
    condicion_vivienda_nombre = serializers.CharField(allow_null=True, required=False)
    codigo_postal_id = serializers.IntegerField(allow_null=True)
    codigo_postal_nombre = serializers.CharField(allow_null=True, required=False)


class PerfilSaludLecturaSerializer(serializers.Serializer):
    grupo_sanguineo_id = serializers.IntegerField(allow_null=True)
    grupo_sanguineo_nombre = serializers.CharField(allow_null=True, required=False)
    alergias = serializers.ListField(child=serializers.IntegerField(), required=False)
    alergias_nombres = serializers.ListField(child=serializers.CharField(), required=False)
    patologias_cronicas = serializers.ListField(child=serializers.IntegerField(), required=False)
    patologias_cronicas_nombres = serializers.ListField(child=serializers.CharField(), required=False)
    discapacidades = serializers.ListField(child=serializers.IntegerField(), required=False)
    discapacidades_nombres = serializers.ListField(child=serializers.CharField(), required=False)


class PerfilFisicoLecturaSerializer(serializers.Serializer):
    talla_camisa_id = serializers.IntegerField(allow_null=True)
    talla_camisa_nombre = serializers.CharField(allow_null=True, required=False)
    talla_pantalon_id = serializers.IntegerField(allow_null=True)
    talla_pantalon_nombre = serializers.CharField(allow_null=True, required=False)
    talla_zapatos_id = serializers.IntegerField(allow_null=True)
    talla_zapatos_nombre = serializers.CharField(allow_null=True, required=False)
    talla_chaqueta_id = serializers.IntegerField(allow_null=True)
    talla_chaqueta_nombre = serializers.CharField(allow_null=True, required=False)


class FormacionComplementariaLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    capacitacion_id = serializers.IntegerField(allow_null=True)
    capacitacion_nombre = serializers.CharField(allow_null=True, required=False)
    institucion_id = serializers.IntegerField(allow_null=True)
    institucion_nombre = serializers.CharField(allow_null=True, required=False)
    fecha_inicio = serializers.CharField(allow_null=True)
    fecha_fin = serializers.CharField(allow_null=True)
    dias_completados = serializers.CharField(allow_null=True)
    horas_completadas = serializers.CharField(allow_null=True)
    procedencia_id = serializers.IntegerField(allow_null=True)
    procedencia_nombre = serializers.CharField(allow_null=True, required=False)
    grupo_id = serializers.IntegerField(allow_null=True)
    grupo_nombre = serializers.CharField(allow_null=True, required=False)


class FormacionAcademicaLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nivel_academico_id = serializers.IntegerField(allow_null=True)
    nivel_academico_nombre = serializers.CharField(allow_null=True, required=False)
    carrera_id = serializers.IntegerField(allow_null=True)
    carrera_nombre = serializers.CharField(allow_null=True, required=False)
    mencion_id = serializers.IntegerField(allow_null=True)
    mencion_nombre = serializers.CharField(allow_null=True, required=False)
    institucion_id = serializers.IntegerField(allow_null=True)
    institucion_nombre = serializers.CharField(allow_null=True, required=False)


class ContactoEmergenciaLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombres = serializers.CharField()
    apellidos = serializers.CharField()
    telefono = serializers.CharField(allow_null=True)
    relacion_id = serializers.IntegerField(allow_null=True)
    relacion_nombre = serializers.CharField(allow_null=True, required=False)


class AntecedenteServicioLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    organismo_id = serializers.IntegerField(allow_null=True)
    organismo_nombre = serializers.CharField(allow_null=True, required=False)
    fecha_ingreso = serializers.CharField(allow_null=True)
    fecha_egreso = serializers.CharField(allow_null=True)


class ContratoLecturaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    n_contrato = serializers.CharField()
    fecha_ingreso = serializers.CharField(allow_null=True, required=False)
    fecha_culminacion = serializers.CharField(allow_null=True)
    politica_id = serializers.IntegerField(allow_null=True)
    politica_nombre = serializers.CharField(allow_null=True, required=False)
    estatus_id = serializers.IntegerField(allow_null=True)
    estatus_nombre = serializers.CharField(allow_null=True, required=False)
    es_fijo = serializers.BooleanField()
