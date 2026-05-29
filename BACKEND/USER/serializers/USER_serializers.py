from rest_framework import serializers
from USER.models import  *
from RAC.models import *
from RAC.serializers.personal_activo_serializers import CleanZerosMixin




class DepartamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = departaments
        fields = ['id', 'nombre_departamento']

class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = ['id', 'nombre_rol']
        

class CuentaSerializer(serializers.ModelSerializer):
    nombres = serializers.CharField(source='cedula.nombres', read_only=True)
    apellidos = serializers.CharField(source='cedula.apellidos', read_only=True)
    correo = serializers.EmailField(source='cedula.correo', read_only=True)
    telefono = serializers.CharField(source='cedula.telefono_movil', read_only=True)
    cedula = serializers.CharField(source='cedula.cedulaidentidad', read_only=True)
    direccion_general = serializers.SerializerMethodField()
    direccion_linea = serializers.SerializerMethodField()
    coordinacion = serializers.SerializerMethodField()
    dependencia = serializers.SerializerMethodField()
    debe_cambiar_password = serializers.SerializerMethodField()

    class Meta:
        model = cuenta
        fields = [
            'id', 'cedula', 'nombres', 'apellidos', 
            'correo', 'telefono', 'departamento', 'rol', 'is_active',
            'dependencia', 'direccion_general', 'direccion_linea', 'coordinacion',
            'debe_cambiar_password'
        ]

    def get_debe_cambiar_password(self, obj):
        # Devuelve True si la contraseña es igual a la cédula (contraseña por defecto)
        return obj.check_password(obj.cedula.cedulaidentidad)

    def _get_asignacion(self, obj):
        if not hasattr(self, '_cached_asig'):
            self._cached_asig = AsigTrabajo.objects.filter(employee=obj.cedula).select_related(
                'Dependencia', 'DireccionGeneral', 'DireccionGeneral__dependenciaId',
                'DireccionLinea', 'Coordinacion'
            ).first()
        return self._cached_asig

    def get_direccion_general(self, obj):
        asig = self._get_asignacion(obj)
        if asig and asig.DireccionGeneral:
            return {'id': asig.DireccionGeneral.id, 'nombre': asig.DireccionGeneral.direccion_general}
        return None

    def get_direccion_linea(self, obj):
        asig = self._get_asignacion(obj)
        if asig and asig.DireccionLinea:
            return {'id': asig.DireccionLinea.id, 'nombre': asig.DireccionLinea.direccion_linea}
        return None

    def get_coordinacion(self, obj):
        asig = self._get_asignacion(obj)
        if asig and asig.Coordinacion:
            return {'id': asig.Coordinacion.id, 'nombre': asig.Coordinacion.coordinacion}
        return None

    def get_dependencia(self, obj):
        asig = self._get_asignacion(obj)
        if asig and asig.DireccionGeneral and asig.DireccionGeneral.dependenciaId:
            dep = asig.DireccionGeneral.dependenciaId
            return {'id': dep.id, 'nombre': dep.dependencia}
        elif asig and asig.Dependencia:
            return {'id': asig.Dependencia.id, 'nombre': asig.Dependencia.dependencia}
        return None
    
    def to_representation(self, instance):
        response = super().to_representation(instance)
        response['departamento'] = DepartamentoSerializer(instance.departamento).data if instance.departamento else None
        response['rol'] = RolSerializer(instance.rol).data if instance.rol else None
        return response
    
    
 
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    correo = serializers.EmailField(write_only=True, required=True)

    class Meta:
        model = cuenta
        fields = ['correo', 'password', 'departamento', 'rol']

    def validate_correo(self, value):
        correo_str = str(value).strip().lower()
        try:
            empleado = Employee.objects.get(correo__iexact=correo_str)
        except Employee.DoesNotExist:
            raise serializers.ValidationError("El correo electrónico no pertenece a ningún empleado registrado en RAC.")
        
        if cuenta.objects.filter(cedula=empleado).exists():
            raise serializers.ValidationError("Este empleado ya posee una cuenta de usuario.")
            
        return empleado

    def create(self, validated_data):
        empleado = validated_data.pop('correo')
        password = validated_data.pop('password')
        
        user = cuenta(cedula=empleado, **validated_data)
        user.set_password(password)
        user.save()
        return user

class UpdateCuentaSerializer(CleanZerosMixin,serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})

    class Meta:
        model = cuenta
        fields = ['departamento', 'rol', 'password']

    def update(self, instance, validated_data):
        if 'password' in validated_data:
            instance.set_password(validated_data.pop('password'))
        
        instance.departamento = validated_data.get('departamento', instance.departamento)
        instance.rol = validated_data.get('rol', instance.rol)
        
        instance.save()
        return instance

class CambiarEstadoCuentaSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(required=False)

    class Meta:
        model = cuenta
        fields = ['is_active']

    def update(self, instance, validated_data):
      
        if 'is_active' in validated_data:
            instance.is_active = validated_data['is_active']
        else:
            instance.is_active = not instance.is_active

        instance.save()
        return instance

class LoginSerializer(serializers.Serializer):
    correo = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True, style={'input_type': 'password'})

    def validate(self, data):
        correo_input = data.get('correo')
        password_input = data.get('password')

        try:
            usuario = cuenta.objects.select_related('cedula', 'departamento', 'rol').get(cedula__correo__iexact=correo_input)
        except cuenta.DoesNotExist:
            raise serializers.ValidationError("Usuario o contraseña inválidos")

        if not usuario.check_password(password_input):
            raise serializers.ValidationError("Usuario o contraseña inválidos")

        if not usuario.is_active:
            raise serializers.ValidationError("Esta cuenta se encuentra inactiva.")

        return usuario