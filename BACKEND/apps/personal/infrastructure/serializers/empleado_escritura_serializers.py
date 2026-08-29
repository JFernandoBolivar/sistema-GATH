"""
Serializers de escritura de Personal (R-08, inventario de reubicación
§I.2.2). Solo validan y transforman (regla B8): NO tienen `create()`/
`update()` — la persistencia (incluida la orquestación de datos anidados)
vive en `apps/personal/infrastructure/repositories/repo_personal_orm.py`,
invocada desde `application/use_cases/gestionar_personal.py` (D-09, B7).

Alcance de datos anidados soportado en esta migración (documentado, ver
`expediente_models.py` para lo que NO se cubre todavía): vivienda, perfil
de salud (escalar), formación académica, contacto de emergencia,
antecedentes de servicio y contrato.
"""
from datetime import date

from rest_framework import serializers

from core.infrastructure.serializer_mixins import CleanZerosMixin
from apps.catalogos.infrastructure.models.catalogo_models import EstadoCivilModel, SexoModel
from apps.personal.infrastructure.models.catalogos_soporte_models import PoliticaModel
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContactoEmergenciaModel,
    DatosViviendaModel,
    FormacionAcademicaModel,
    PerfilSaludModel,
)


class DatosViviendaEscrituraSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatosViviendaModel
        fields = ['estado', 'municipio', 'parroquia', 'direccion_exacta', 'condicion_vivienda', 'codigo_postal']


class PerfilSaludEscrituraSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerfilSaludModel
        fields = ['grupo_sanguineo']


class FormacionAcademicaEscrituraSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormacionAcademicaModel
        fields = ['nivel_academico', 'carrera', 'mencion', 'institucion']


class ContactoEmergenciaEscrituraSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactoEmergenciaModel
        fields = ['nombres', 'apellidos', 'telefono', 'relacion']


class AntecedenteServicioEscrituraSerializer(serializers.ModelSerializer):
    class Meta:
        model = AntecedenteServicioModel
        fields = ['organismo', 'fecha_ingreso', 'fecha_egreso']

    def validate(self, attrs):
        inicio = attrs.get('fecha_ingreso')
        fin = attrs.get('fecha_egreso')
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError(
                'La fecha de egreso no puede ser anterior a la fecha de ingreso.'
            )
        return attrs


class ContratoEscrituraSerializer(serializers.Serializer):
    """
    No es `ModelSerializer`: el caso de uso `upsert_contrato` decide número
    de contrato, antecedente asociado y estatus — no es una escritura 1:1
    sobre `ContratoModel` (mismo diseño que el legado `ContratoSerializer`
    + `profile_services.upsert_contrato`).
    """
    n_contrato = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    fecha_ingreso = serializers.DateField(required=True)
    fecha_culminacion = serializers.DateField(required=False, allow_null=True)
    politica_id = serializers.PrimaryKeyRelatedField(queryset=PoliticaModel.objects.all())


class EmpleadoEscrituraSerializer(CleanZerosMixin, serializers.Serializer):
    """
    Base compartida por `EmpleadoCrearSerializer`/`EmpleadoActualizarSerializer`.
    Réplica de las validaciones de campo de
    `RAC/serializers/personal_activo_serializers.py::EmployeeCreateUpdateSerializer`
    (uppercase de nombres/apellidos, edad mínima, inmutabilidad de cédula).

    Es `serializers.Serializer` plano (no `ModelSerializer`): los nombres de
    campo siguen el contrato PLANO ya establecido y probado de
    `RepoPersonalORM.crear_empleado`/`actualizar_empleado`
    (`cedula`, `sexo_id`, `estado_civil_id`, ...) en vez de los nombres de
    columna del modelo (`cedulaidentidad`, `sexoid`, `estadoCivil`) — así
    `validated_data` es directamente el `datos: dict` que ya espera el
    repositorio (sin romper el contrato existente ni sus tests,
    `tests/unit/personal/test_personal.py`).
    """
    correo = serializers.EmailField(required=False, allow_null=True)
    telefono_movil = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    telefono_habitacion = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    estado_civil_id = serializers.PrimaryKeyRelatedField(
        queryset=EstadoCivilModel.objects.all(), required=False, allow_null=True,
    )
    carnet_patria = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=30)

    datos_vivienda = DatosViviendaEscrituraSerializer(required=False)
    perfil_salud = PerfilSaludEscrituraSerializer(required=False)
    formacion_academica = FormacionAcademicaEscrituraSerializer(many=True, required=False)
    contacto_emergencia = ContactoEmergenciaEscrituraSerializer(many=True, required=False)
    antecedentes = AntecedenteServicioEscrituraSerializer(many=True, required=False)
    contrato = ContratoEscrituraSerializer(many=True, required=False)

    def validate_cedula(self, value):
        if self.instance and self.instance.cedulaidentidad != value:
            raise serializers.ValidationError('La cédula de identidad no puede ser modificada.')
        return value

    def validate_nombres(self, value):
        return value.upper() if value else value

    def validate_apellidos(self, value):
        return value.upper() if value else value

    def validate_fecha_nacimiento(self, value):
        if not value:
            return value
        hoy = date.today()
        edad = hoy.year - value.year - ((hoy.month, hoy.day) < (value.month, value.day))
        if edad <= 15:
            raise serializers.ValidationError('El empleado debe ser mayor de 15 años.')
        return value

    def to_internal_value(self, data):
        """
        Convierte `estado_civil_id` (instancia resuelta por
        `PrimaryKeyRelatedField`) de vuelta a un id plano, y aplana las
        claves anidadas para que coincidan exactamente con lo que espera
        `RepoPersonalORM` (`sexo_id` en vez de `sexoid`, etc.).
        """
        validado = super().to_internal_value(data)
        if 'estado_civil_id' in validado and validado['estado_civil_id'] is not None:
            validado['estado_civil_id'] = validado['estado_civil_id'].pk
        return validado


class EmpleadoCrearSerializer(EmpleadoEscrituraSerializer):
    cedula = serializers.CharField(required=True, max_length=20)
    nombres = serializers.CharField(required=True, max_length=150)
    apellidos = serializers.CharField(required=True, max_length=150)
    sexo_id = serializers.PrimaryKeyRelatedField(queryset=SexoModel.objects.all())
    fecha_nacimiento = serializers.DateField(required=True)

    def to_internal_value(self, data):
        validado = super().to_internal_value(data)
        if 'sexo_id' in validado and validado['sexo_id'] is not None:
            validado['sexo_id'] = validado['sexo_id'].pk
        return validado


class EmpleadoActualizarSerializer(EmpleadoEscrituraSerializer):
    cedula = serializers.CharField(required=False, max_length=20)
    nombres = serializers.CharField(required=False, max_length=150)
    apellidos = serializers.CharField(required=False, max_length=150)
    sexo_id = serializers.PrimaryKeyRelatedField(queryset=SexoModel.objects.all(), required=False)
    fecha_nacimiento = serializers.DateField(required=False)

    def to_internal_value(self, data):
        validado = super().to_internal_value(data)
        if 'sexo_id' in validado and validado['sexo_id'] is not None:
            validado['sexo_id'] = validado['sexo_id'].pk
        return validado
