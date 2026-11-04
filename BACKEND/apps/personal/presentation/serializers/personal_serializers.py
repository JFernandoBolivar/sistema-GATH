"""
Serializers de Presentación de Personal.
"""
from rest_framework import serializers

from core.presentation.serializers.expediente_lectura import (
    AntecedenteServicioLecturaSerializer,
    ContactoEmergenciaLecturaSerializer,
    ContratoLecturaSerializer,
    DatosViviendaLecturaSerializer,
    FormacionAcademicaLecturaSerializer,
    FormacionComplementariaLecturaSerializer,
    PerfilFisicoLecturaSerializer,
    PerfilSaludLecturaSerializer,
)


class EmpleadoListadoSerializer(serializers.Serializer):
    """Listado liviano de personal activo.

    Solo los campos que consume la tabla de `/personal/consultar` (columnas y
    acciones de fila). El expediente completo sigue viviendo en
    `GET /api/v1/personal/<cedula>/` con `EmpleadoSerializer`.
    """

    id = serializers.IntegerField(read_only=True)
    cedula = serializers.CharField(read_only=True)
    nombres = serializers.CharField(read_only=True)
    apellidos = serializers.CharField(read_only=True)
    nombre_completo = serializers.CharField(read_only=True)
    sexo_id = serializers.IntegerField(read_only=True)
    sexo_nombre = serializers.CharField(read_only=True)
    fecha_nacimiento = serializers.CharField(read_only=True, allow_null=True)
    contrato_actual = ContratoLecturaSerializer(read_only=True, allow_null=True)


class ListadoEmpleadosPaginadoSerializer(serializers.Serializer):
    """Sobre C-1 de una página del listado de personal activo."""

    results = EmpleadoListadoSerializer(many=True)
    total = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()


class EmpleadoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    cedula = serializers.CharField(read_only=True)
    nombres = serializers.CharField(read_only=True)
    apellidos = serializers.CharField(read_only=True)
    nombre_completo = serializers.CharField(read_only=True)
    sexo_id = serializers.IntegerField(read_only=True)
    sexo_nombre = serializers.CharField(read_only=True)
    correo = serializers.EmailField(read_only=True, allow_null=True)
    correo_alternativo = serializers.CharField(read_only=True, allow_null=True, required=False)
    telefono_movil = serializers.CharField(read_only=True, allow_null=True)
    telefono_habitacion = serializers.CharField(read_only=True, allow_null=True)
    fecha_nacimiento = serializers.CharField(read_only=True, allow_null=True)
    estado_civil_id = serializers.IntegerField(read_only=True, allow_null=True)
    estado_civil_nombre = serializers.CharField(read_only=True, allow_null=True)
    carnet_patria = serializers.CharField(read_only=True, allow_null=True)
    carnet_patria_serial = serializers.CharField(read_only=True, allow_null=True)
    nacionalidad_id = serializers.IntegerField(read_only=True, default=1)
    nacionalidad_codigo = serializers.CharField(read_only=True, default="V")
    nacionalidad_nombre = serializers.CharField(read_only=True, default="VENEZOLANA")
    total_anos_apn = serializers.FloatField(read_only=True)
    profile = serializers.CharField(read_only=True, allow_null=True, required=False)
    foto_url = serializers.CharField(read_only=True, allow_null=True, required=False)
    # Expediente anidado (Fase 2.2, `PLAN_REPARACION_GATH.md`): solo viene
    # poblado en el detalle (`GET /api/v1/personal/<cedula>/`); el listado
    # devuelve estos campos vacíos a propósito (ver `_construir_expediente`
    # en `repo_personal_orm.py`).
    datos_vivienda = DatosViviendaLecturaSerializer(read_only=True, allow_null=True)
    perfil_salud = PerfilSaludLecturaSerializer(read_only=True, allow_null=True)
    perfil_fisico = PerfilFisicoLecturaSerializer(read_only=True, allow_null=True)
    formacion_academica = FormacionAcademicaLecturaSerializer(read_only=True, many=True)
    formacion_complementaria = FormacionComplementariaLecturaSerializer(read_only=True, many=True)
    contacto_emergencia = ContactoEmergenciaLecturaSerializer(read_only=True, many=True)
    antecedentes = AntecedenteServicioLecturaSerializer(read_only=True, many=True)
    contrato_actual = ContratoLecturaSerializer(read_only=True, allow_null=True)
    contratos = serializers.ListField(child=serializers.DictField(), read_only=True, required=False)
    asignaciones = serializers.ListField(child=serializers.DictField(), read_only=True, required=False)
    encargadurias = serializers.ListField(child=serializers.DictField(), read_only=True, required=False)
