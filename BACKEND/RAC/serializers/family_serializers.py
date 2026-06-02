from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from django.db import transaction
from ..models.family_personal_models import Employeefamily, Parentesco, FamilyDocument
from ..models.personal_models import *
from USER.models.user_models import cuenta as User
from datetime import date
from RAC.serializers.personal_activo_serializers import *
from ..services.profile_services import (
    create_health_profile, create_physical_profile, create_academic_profile,
    upsert_health_profile, upsert_physical_profile, upsert_academic_profile,
)
from ..services.family_services import (
    validate_cedula_no_repetida,
    validate_cedula_unica_por_empleado,
    generar_cedula_hijo_menor,
    validate_heredero_unico,
)

class FamilyCreateSerializer(serializers.ModelSerializer):
    employeecedula = serializers.ReadOnlyField(source='employeecedula.cedulaidentidad')
    
    cedulaFamiliar = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    fechanacimiento = serializers.DateField(allow_null=True, input_formats=['iso-8601', '%Y-%m-%d','%Y-%m-%dT%H:%M:%S.%fZ'])
    usuario_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    orden_hijo = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    perfil_salud_familiar = PerfilSaludSerializer(required=False)
    perfil_fisico_familiar = PerfilFisicoSerializer(required=False)
    formacion_academica_familiar = FormacionAcademicaSerializer(required=False)

    class Meta:
        model = Employeefamily
        fields = [
            'employeecedula', 'cedulaFamiliar', 'primer_nombre', 'segundo_nombre',
            'primer_apellido', 'segundo_apellido', 'parentesco', 'fechanacimiento',
            'sexo', 'estadoCivil', 'observaciones', 'usuario_id', 'mismo_ente',
            'heredero', 'perfil_salud_familiar', 'perfil_fisico_familiar', 
            'formacion_academica_familiar', 'orden_hijo'
        ]

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else data
        for campo in ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido']:
            if data.get(campo):
                data[campo] = str(data[campo]).strip().upper()

        def limp_ceros(dictionary):
            if not isinstance(dictionary, dict): return dictionary
            for key, value in dictionary.items():
                if isinstance(value, bool): continue
                if isinstance(value, list):
                    dictionary[key] = [item for item in value if item != 0]
                elif value == 0:
                    dictionary[key] = None
            return dictionary
        
        data = limp_ceros(data)
        for obj_key in ['perfil_salud_familiar', 'perfil_fisico_familiar', 'formacion_academica_familiar']:
            if obj_key in data and isinstance(data[obj_key], dict):
                data[obj_key] = limp_ceros(data[obj_key])
            
        return super().to_internal_value(data)

    def validate(self, data):
        empleado = self.context.get('empleado')
        cedula_fam = data.get('cedulaFamiliar')
        parentesco_obj = data.get('parentesco')
        fecha_nac = data.get('fechanacimiento')
        orden_manual = data.get('orden_hijo')
        exclude_id = self.instance.pk if self.instance else None

        try:
            validate_cedula_no_repetida(empleado, cedula_fam)
            if not self.instance:
                validate_cedula_unica_por_empleado(empleado, cedula_fam)
        except ValueError as e:
            raise serializers.ValidationError(str(e))

        if not cedula_fam or str(cedula_fam).strip().lower() in ["", "string", "null"]:
            try:
                nueva_cedula = generar_cedula_hijo_menor(
                    empleado, parentesco_obj, fecha_nac,
                    orden_manual=orden_manual, exclude_id=exclude_id,
                )
            except ValueError as e:
                raise serializers.ValidationError(str(e))
            if nueva_cedula:
                data['cedulaFamiliar'] = nueva_cedula
            else:
                raise serializers.ValidationError({
                    "cedulaFamiliar": "La cédula es obligatoria a menos que el familiar sea un HIJO (A) menor de 9 años."
                })

        heredero = data.get('heredero', False)
        try:
            validate_heredero_unico(empleado, heredero, exclude_id=exclude_id)
        except ValueError as e:
            raise serializers.ValidationError(str(e))
        
        return data

    def create(self, validated_data):
        validated_data['employeecedula'] = self.context.get('empleado')
        
        validated_data.pop('orden_hijo', None)
        id_usuario = validated_data.pop('usuario_id')
        salud_data = validated_data.pop('perfil_salud_familiar', None)
        fisico_data = validated_data.pop('perfil_fisico_familiar', None)
        academico_data = validated_data.pop('formacion_academica_familiar', None)
        
        try:
            with transaction.atomic():
                instance = Employeefamily.objects.create(**validated_data)
                instance._history_user = id_usuario
                instance.save()

                create_health_profile(instance, salud_data, 'familiar_id')
                create_physical_profile(instance, fisico_data, 'familiar_id')
                create_academic_profile(instance, academico_data, 'familiar_id')
                    
                return instance
        except Exception as e:
            raise serializers.ValidationError(f"Error al guardar el registro familiar: {str(e)}")

    def update(self, instance, validated_data):
        validated_data.pop('orden_hijo', None)
        usuario = validated_data.pop('usuario_id', None)
        salud_data = validated_data.pop('perfil_salud_familiar', None)
        fisico_data = validated_data.pop('perfil_fisico_familiar', None)
        academico_data = validated_data.pop('formacion_academica_familiar', None)
        
        if usuario:
            instance._history_user = usuario

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            upsert_health_profile(instance, salud_data, 'familiar_id')
            upsert_physical_profile(instance, fisico_data, 'familiar_id')
            upsert_academic_profile(instance, academico_data, 'familiar_id')
        return instance




    
class FamilyListSerializer(serializers.ModelSerializer):
    employeecedula = serializers.ReadOnlyField(source='employeecedula.cedulaidentidad')
    parentesco = ParentescoSerializer(read_only=True)
    sexo = SexoSerializer(read_only=True)
    estadoCivil = EstadoCivilSerializer(read_only=True)
    perfil_salud_familiar = serializers.SerializerMethodField()
    perfil_fisico_familiar = serializers.SerializerMethodField()
    formacion_academica_familiar = serializers.SerializerMethodField()

    class Meta:
        model = Employeefamily
        fields = [
            'id', 'employeecedula', 'cedulaFamiliar', 'primer_nombre', 'segundo_nombre', 
            'primer_apellido', 'segundo_apellido', 'parentesco', 
            'fechanacimiento', 'sexo', 'estadoCivil', 'mismo_ente', 
            'heredero', 'perfil_salud_familiar', 'perfil_fisico_familiar', 
            'formacion_academica_familiar', 'observaciones', 
            'createdat', 'updatedat'
        ]

    def get_perfil_salud_familiar(self, obj):
        instancia = obj.perfil_salud_set.first()
        return PerfilSaludSerializer(instancia).data if instancia else None

    def get_perfil_fisico_familiar(self, obj):
        instancia = obj.perfil_fisico_set.first()
        return PerfilFisicoSerializer(instancia).data if instancia else None

    def get_formacion_academica_familiar(self, obj):
        instancia = obj.formacion_academica_set.first()
        return FormacionAcademicaSerializer(instancia).data if instancia else None


class FamilyDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyDocument
        fields = ['id', 'document_type', 'file', 'uploaded_at']


class FamilyDocumentReadSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()

    class Meta:
        model = FamilyDocument
        fields = ['id', 'document_type', 'file', 'uploaded_at']

    def get_file(self, obj):
        request = self.context.get('request')
        if obj.file:
            download_path = f"/api/Employeefamily/documentos/{obj.id}/descargar/"
            if request:
                return request.build_absolute_uri(download_path)
            return download_path
        return None
   