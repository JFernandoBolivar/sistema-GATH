"""
Serializers de Presentación de catálogos de soporte del expediente de personal
(vivienda, académico, contrato, salud).

Un `CatalogoItemSerializer` genérico sirve para las tablas maestras de solo
lectura: `{ id, nombre }`. Filas con un campo único de texto (`politicas`,
`condicion_vivienda`, `GrupoSanguineo`, `NivelAcademico`, `carreras`,
`Menciones`, `Instituciones`) y las geográficas se aplanan al mismo contrato
para que el frontend las consuma igual.
"""
from rest_framework import serializers


class CatalogoItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    codigo = serializers.CharField(read_only=True, allow_null=True, required=False)
