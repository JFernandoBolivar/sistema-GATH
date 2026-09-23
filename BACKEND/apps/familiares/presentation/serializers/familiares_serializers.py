"""
Serializers de Presentación de Familiares.
"""
from rest_framework import serializers

from apps.catalogos.infrastructure.models.catalogo_models import ParentescoModel
from apps.familiares.application.use_cases.validaciones_familiar import (
    resolver_cedula_familiar,
    validar_cedula_no_duplicada,
    validar_heredero_unico,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CarreraModel,
    DiscapacidadModel,
    GrupoSanguineoModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
    TallaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class FormacionAcademicaFamiliarDetalleSerializer(serializers.Serializer):
    nivel_academico_id = serializers.IntegerField(read_only=True, allow_null=True)
    carrera_id = serializers.IntegerField(read_only=True, allow_null=True)
    mencion_id = serializers.IntegerField(read_only=True, allow_null=True)
    institucion_id = serializers.IntegerField(read_only=True, allow_null=True)


class PerfilSaludFamiliarDetalleSerializer(serializers.Serializer):
    grupo_sanguineo_id = serializers.IntegerField(read_only=True, allow_null=True)
    alergias = serializers.ListField(child=serializers.IntegerField(), read_only=True)
    patologias_cronicas = serializers.ListField(child=serializers.IntegerField(), read_only=True)
    discapacidades = serializers.ListField(child=serializers.IntegerField(), read_only=True)


class PerfilFisicoFamiliarDetalleSerializer(serializers.Serializer):
    talla_camisa_id = serializers.IntegerField(read_only=True, allow_null=True)
    talla_pantalon_id = serializers.IntegerField(read_only=True, allow_null=True)
    talla_zapatos_id = serializers.IntegerField(read_only=True, allow_null=True)
    talla_chaqueta_id = serializers.IntegerField(read_only=True, allow_null=True)


class FormacionAcademicaFamiliarEscrituraSerializer(serializers.Serializer):
    """
    Contrato de escritura con sufijo `_id` (mismo criterio que el resto de
    catálogos de familiares) -- réplica funcional de
    `PerfilSaludEscrituraSerializer`/`FormacionAcademicaEscrituraSerializer`
    de `apps.personal`, mismos modelos, sufijo `_id` explícito.
    """
    nivel_academico_id = serializers.PrimaryKeyRelatedField(
        source='nivel_academico', queryset=NivelAcademicoModel.objects.all(), required=False, allow_null=True,
    )
    carrera_id = serializers.PrimaryKeyRelatedField(
        source='carrera', queryset=CarreraModel.objects.all(), required=False, allow_null=True,
    )
    mencion_id = serializers.PrimaryKeyRelatedField(
        source='mencion', queryset=MencionModel.objects.all(), required=False, allow_null=True,
    )
    institucion_id = serializers.PrimaryKeyRelatedField(
        source='institucion', queryset=InstitucionModel.objects.all(), required=False, allow_null=True,
    )

    def to_internal_value(self, data):
        validado = super().to_internal_value(data)
        return {
            'nivel_academico_id': validado['nivel_academico'].pk if validado.get('nivel_academico') else None,
            'carrera_id': validado['carrera'].pk if validado.get('carrera') else None,
            'mencion_id': validado['mencion'].pk if validado.get('mencion') else None,
            'institucion_id': validado['institucion'].pk if validado.get('institucion') else None,
        }


class PerfilSaludFamiliarEscrituraSerializer(serializers.Serializer):
    grupo_sanguineo_id = serializers.PrimaryKeyRelatedField(
        source='grupo_sanguineo', queryset=GrupoSanguineoModel.objects.all(), required=False, allow_null=True,
    )
    alergias = serializers.PrimaryKeyRelatedField(many=True, queryset=AlergiaModel.objects.all(), required=False)
    patologias_cronicas = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PatologiaCronicaModel.objects.all(), required=False,
    )
    discapacidades = serializers.PrimaryKeyRelatedField(
        many=True, queryset=DiscapacidadModel.objects.all(), required=False,
    )

    def to_internal_value(self, data):
        validado = super().to_internal_value(data)
        return {
            'grupo_sanguineo_id': validado['grupo_sanguineo'].pk if validado.get('grupo_sanguineo') else None,
            'alergias': [i.pk for i in validado['alergias']] if 'alergias' in validado else None,
            'patologias_cronicas': [i.pk for i in validado['patologias_cronicas']] if 'patologias_cronicas' in validado else None,
            'discapacidades': [i.pk for i in validado['discapacidades']] if 'discapacidades' in validado else None,
        }


class PerfilFisicoFamiliarEscrituraSerializer(serializers.Serializer):
    talla_camisa_id = serializers.PrimaryKeyRelatedField(
        source='talla_camisa', queryset=TallaModel.objects.all(), required=False, allow_null=True,
    )
    talla_pantalon_id = serializers.PrimaryKeyRelatedField(
        source='talla_pantalon', queryset=TallaModel.objects.all(), required=False, allow_null=True,
    )
    talla_zapatos_id = serializers.PrimaryKeyRelatedField(
        source='talla_zapatos', queryset=TallaModel.objects.all(), required=False, allow_null=True,
    )
    talla_chaqueta_id = serializers.PrimaryKeyRelatedField(
        source='talla_chaqueta', queryset=TallaModel.objects.all(), required=False, allow_null=True,
    )

    def to_internal_value(self, data):
        validado = super().to_internal_value(data)
        return {
            'talla_camisa_id': validado['talla_camisa'].pk if validado.get('talla_camisa') else None,
            'talla_pantalon_id': validado['talla_pantalon'].pk if validado.get('talla_pantalon') else None,
            'talla_zapatos_id': validado['talla_zapatos'].pk if validado.get('talla_zapatos') else None,
            'talla_chaqueta_id': validado['talla_chaqueta'].pk if validado.get('talla_chaqueta') else None,
        }


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
    perfil_salud = PerfilSaludFamiliarDetalleSerializer(read_only=True, allow_null=True)
    perfil_fisico = PerfilFisicoFamiliarDetalleSerializer(read_only=True, allow_null=True)
    formacion_academica = FormacionAcademicaFamiliarDetalleSerializer(read_only=True, allow_null=True)


class RegistrarFamiliarInputSerializer(serializers.Serializer):
    """
    Reglas de negocio (paridad con `RAC/services/family_services.py` del
    legado): la cédula del familiar no puede repetir la del empleado ni la
    de otro familiar ya registrado del mismo empleado; si el familiar es un
    "HIJO (A)" menor de 9 años sin cédula propia, se genera una sintética
    "<cédula del empleado>-<n>"; solo puede haber un heredero por empleado.
    """
    empleado_cedula = serializers.CharField(required=True, max_length=20)
    primer_nombre = serializers.CharField(required=True, max_length=150)
    segundo_nombre = serializers.CharField(required=False, allow_blank=True, max_length=150)
    primer_apellido = serializers.CharField(required=True, max_length=150)
    segundo_apellido = serializers.CharField(required=False, allow_blank=True, max_length=150)
    cedula_familiar = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    parentesco_id = serializers.IntegerField(required=True)
    fecha_nacimiento = serializers.DateField(required=True)
    sexo_id = serializers.IntegerField(required=True)
    mismo_ente = serializers.BooleanField(required=False, default=False)
    heredero = serializers.BooleanField(required=False, default=False)
    observaciones = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    perfil_salud = PerfilSaludFamiliarEscrituraSerializer(required=False, allow_null=True)
    perfil_fisico = PerfilFisicoFamiliarEscrituraSerializer(required=False, allow_null=True)
    formacion_academica = FormacionAcademicaFamiliarEscrituraSerializer(required=False, allow_null=True)

    def validate(self, attrs):
        empleado_cedula = attrs.get('empleado_cedula') or self.context.get('empleado_cedula')
        empleado = EmployeeModel.objects.filter(cedulaidentidad=empleado_cedula).first()
        if empleado is None:
            raise serializers.ValidationError({'empleado_cedula': 'Empleado no encontrado.'})
        cedula_empleado = str(empleado.cedulaidentidad)

        excluir_id = self.instance.pk if self.instance else None
        cedula_familiar = (attrs.get('cedula_familiar') or '').strip() or None
        toca_identidad = not self.partial or {'cedula_familiar', 'parentesco_id', 'fecha_nacimiento'} & set(attrs.keys())

        if cedula_familiar or toca_identidad:
            parentesco_id = attrs.get('parentesco_id')
            es_hijo = ParentescoModel.objects.filter(
                pk=parentesco_id, descripcion_parentesco__iexact='HIJO (A)',
            ).exists()
            siguiente_orden = EmployeefamilyModel.objects.filter(
                employeecedula=empleado, cedulaFamiliar__startswith=f"{cedula_empleado.strip()}-",
            ).count() + 1
            try:
                cedula_resuelta = resolver_cedula_familiar(
                    cedula_familiar=cedula_familiar,
                    cedula_empleado=cedula_empleado,
                    es_hijo=es_hijo,
                    fecha_nacimiento=attrs.get('fecha_nacimiento'),
                    siguiente_orden_hijo=siguiente_orden,
                )
                cedulas_qs = EmployeefamilyModel.objects.filter(employeecedula=empleado).exclude(pk=excluir_id)
                validar_cedula_no_duplicada(
                    cedula_resuelta, set(cedulas_qs.values_list('cedulaFamiliar', flat=True)),
                )
            except ValueError as e:
                raise serializers.ValidationError({'cedula_familiar': str(e)})
            attrs['cedula_familiar'] = cedula_resuelta

        if attrs.get('heredero'):
            qs = EmployeefamilyModel.objects.filter(employeecedula=empleado, heredero=True)
            if excluir_id is not None:
                qs = qs.exclude(pk=excluir_id)
            try:
                validar_heredero_unico(True, qs.exists())
            except ValueError as e:
                raise serializers.ValidationError({'heredero': str(e)})

        return attrs


class DocumentoFamiliarSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    familiar_id = serializers.IntegerField(read_only=True)
    tipo_documento = serializers.CharField(read_only=True)
    ruta_archivo = serializers.CharField(read_only=True)
    fecha_subida = serializers.CharField(read_only=True)
