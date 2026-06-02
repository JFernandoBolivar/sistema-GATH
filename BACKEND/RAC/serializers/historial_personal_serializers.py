from rest_framework import serializers

from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist

from ..models.historial_personal_models import *

from ..models.personal_models import *
from ..serializers.catalogs_serializers import *

from USER.models.user_models import cuenta as User

from ..services.constants_historial import *

from ..utils.constants import *

from ..services.egreso_services import (
    generar_codigo_nomina,
    validar_y_preparar_sobrevivientes,
    procesar_egreso_total,
    procesar_pasivo,
    ejecutar_creacion_sobrevivientes,
)




class TipoMovimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tipo_movimiento
        fields = [
            "id",
            "movimiento"
        ]
        

class MovimintoCargoSerializer(serializers.Serializer):
    nuevo_cargo_id = serializers.PrimaryKeyRelatedField(queryset=AsigTrabajo.objects.all())
    usuario_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    motivo = serializers.PrimaryKeyRelatedField(queryset=Tipo_movimiento.objects.all())

    def validate_nuevo_cargo_id(self, value):
     
        try:
            estatus_vacante = Estatus.objects.get(estatus__iexact=ESTATUS_VACANTE)
        except Estatus.DoesNotExist:
            raise serializers.ValidationError("No existe el estatus 'VACANTE'")

        if value.estatusid != estatus_vacante:
            raise serializers.ValidationError("El cargo seleccionado ya está ocupado")
        
        return value
 

    @transaction.atomic
    def update(self, instance, validated_data):
        puesto_nuevo = validated_data['nuevo_cargo_id']
        usuario = validated_data['usuario_id']
        motivo = validated_data['motivo']
        empleado = instance.employee

        try:
            estatus_vacante = Estatus.objects.get(estatus__iexact=ESTATUS_VACANTE)
            estatus_activo = Estatus.objects.get(estatus__iexact=ESTATUS_ACTIVO)
        except Estatus.DoesNotExist:
            raise serializers.ValidationError("Error de datos de estatus")

        # LIBERAR CARGO ACTUAL
        instance.employee = None
        instance.estatusid = estatus_vacante
        instance.save()

        # OCUPAR NUEVO PUESTO
        puesto_nuevo.employee = empleado
        puesto_nuevo.estatusid = estatus_activo
        puesto_nuevo.observaciones = motivo.movimiento
        puesto_nuevo.save()

        #REGISTRO EN EL HISTORIAL
        registrar_historial_movimiento(
            empleado=empleado,
            puesto=puesto_nuevo, 
            tipo_movimiento='TRASLADO',
            motivo=motivo,
            usuario=usuario
        )

        return puesto_nuevo



# SERIALIZER BASE PARA LA GESTION DE LOS ESTATUS 
class BaseActionInputSerializer(serializers.Serializer):
    estatus_id = serializers.PrimaryKeyRelatedField(
        queryset=Estatus.objects.all(),
        source='estatus' 
    )
    usuario_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='usuario' 
    )


# SERILIZER PARA GESTIONAR CAMBIO DE ESTATUS 
class GestionStatusSerializer(BaseActionInputSerializer):
    motivo = serializers.PrimaryKeyRelatedField(queryset=Tipo_movimiento.objects.all())

    def validate_estatus_id(self, value):
        if value.estatus.upper() not in ESTATUS_PERMITIDOS:
            raise serializers.ValidationError("Gestión de estatus no permitido")
        return value

    def validate(self, attrs):
        if self.instance and self.instance.estatusid == attrs.get('estatus'):
            raise serializers.ValidationError(
                {"estatus_id": f"El cargo ya se encuentra en estatus '{self.instance.estatusid.estatus}'"}
            )
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        nuevo_estatus = validated_data['estatus'] 
        usuario = validated_data['usuario']
        motivo = validated_data['motivo']
        empleado = instance.employee

        instance.estatusid = nuevo_estatus
        instance.observaciones = motivo.movimiento
        instance.save()

        registrar_historial_movimiento(
            empleado=empleado,
            puesto=instance,
            tipo_movimiento='CAMBIO DE ESTATUS',
            motivo= motivo,
            usuario=usuario
        )

        return instance

# SERIALIZER PARA GESTIONAR EGRESOS Y PERSONAL PASIVO 
class SobrevivienteItemSerializer(serializers.Serializer):
    cedula_familiar = serializers.CharField(
        help_text="Cédula del familiar que recibirá la pensión",
        required=True
    )
    codigo = serializers.CharField(
        help_text="Código para el nuevo puesto del pensionado sobreviviente",
        required=False,
        max_length=50,
        allow_blank=True,
        allow_null=True
    )

class GestionEgreso_PasivoSerializer(BaseActionInputSerializer):
    motivo = serializers.PrimaryKeyRelatedField(queryset=Tipo_movimiento.objects.all())
    tiponominaid = serializers.IntegerField(required=False, allow_null=True)
    codigo_nuevo = serializers.CharField(required=False, max_length=50, allow_blank=True, allow_null=True)
    liberar_activos = serializers.BooleanField(required=False, default=False)
    
    # Nuevo campo para la lista de sobrevivientes
    sobrevivientes = SobrevivienteItemSerializer(many=True, required=False)

    def validate(self, data):
        estatus_obj = data['estatus']
        estatus_nombre = estatus_obj.estatus.upper()

        if estatus_nombre not in ESTATUS_PERMITIDOS_EGRESOS:
            raise serializers.ValidationError("Tipo de estatus no permitido")

        if estatus_nombre == "PASIVO":
            if not data.get('tiponominaid'):
                raise serializers.ValidationError({'tiponominaid': "Es obligatorio asignar una nomina para personal PASIVO"})
            
            codigo = data.get('codigo_nuevo')
            if codigo:
                if AsigTrabajo.objects.filter(codigo=codigo).exists():
                    raise serializers.ValidationError({'codigo_nuevo': "Este codigo de puesto ya esta en uso"})
            else:
                tipo_nomina = Tiponomina.objects.get(id=data['tiponominaid'])
                data['codigo_nuevo'] = generar_codigo_nomina(tipo_nomina)

        sobrevivientes_input = data.get('sobrevivientes')
        if sobrevivientes_input:
            if estatus_nombre != "EGRESADO":
                raise serializers.ValidationError("La carga de sobrevivientes solo es permitida para estatus EGRESADO.")
            try:
                resultado = validar_y_preparar_sobrevivientes(sobrevivientes_input)
            except (ValueError, ObjectDoesNotExist) as e:
                raise serializers.ValidationError(str(e))
            data['nomina_pension_obj'] = resultado['nomina_pension']
            data['familiares_validados_list'] = resultado['familiares_validados']

        return data

    @transaction.atomic
    def update(self, instance, validated_data):
        usuario = validated_data['usuario']
        estatus_obj = validated_data['estatus']
        estatus_nombre = estatus_obj.estatus.upper()
        motivo = validated_data['motivo']
       
        try:
            estatus_vacante = Estatus.objects.get(estatus__iexact=ESTATUS_VACANTE)
        except Estatus.DoesNotExist:
            raise serializers.ValidationError("Estatus VACANTE no configurado")
       
        if estatus_nombre == "EGRESADO":
            procesar_egreso_total(instance, motivo, usuario, estatus_vacante)
            
            familiares = validated_data.get('familiares_validados_list')
            if familiares:
                nomina = validated_data.get('nomina_pension_obj')
                ejecutar_creacion_sobrevivientes(familiares, nomina, usuario)
                
            return instance

        if estatus_nombre == "PASIVO":
            return procesar_pasivo(
                instance,
                codigo_nuevo=validated_data['codigo_nuevo'],
                tiponominaid=validated_data['tiponominaid'],
                motivo_obj=motivo,
                usuario=usuario,
                estatus_vacante=estatus_vacante,
                liberar_activos=validated_data.get('liberar_activos', False),
            )

        return instance


class CargoEgresadoSerializer(serializers.ModelSerializer):
    denominacioncargo = denominacionCargoSerializer(source='denominacioncargoid', read_only=True)
    denominacioncargoespecifico = denominacionCargoEspecificoSerializer(source='denominacioncargoespecificoid', read_only=True)
    grado = gradoSerializer(source='gradoid', read_only=True)
    tiponomina = TipoNominaSerializer(source='tiponominaid', read_only=True)
    DireccionGeneral = DireccionGeneralSerializer(read_only=True)
    DireccionLinea = DireccionLineaSerializer(read_only=True)
    Coordinacion = CoordinacionSerializer(read_only=True)
    OrganismoAdscrito = OrganismoAdscritoSerializer(source='OrganismoAdscritoid', read_only=True)

    class Meta:
        model = CargoEgresado
        fields = [
            'id',
            'codigo', 'denominacioncargo', 'denominacioncargoespecifico', 
            'grado', 'tiponomina', 'DireccionGeneral', 
            'DireccionLinea', 'Coordinacion', 'OrganismoAdscrito'
        ]
 

    
class TipoMovimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tipo_movimiento
        fields = ['id', 'movimiento']
    
    

        
class EmployeeCargoHistorySerializer(serializers.ModelSerializer):
    modificado_por_usuario = serializers.SerializerMethodField()
    cedula_analista = serializers.CharField(source='ejecutado_por.cedula.cedulaidentidad', read_only=True)
    motivo_movimiento = TipoMovimientoSerializer(source='motivo',read_only=True)
    new_estatus = EstatusSerializer(source='estatus',read_only=True)
    new_tipoPersonal = TipoPersonalSerializer(source='tipo_personal',read_only=True)
    new_denominacioncargo = denominacionCargoSerializer(source='denominacioncargo',read_only=True)
    new_denominacioncargoespecifico = denominacionCargoEspecificoSerializer(source='denominacioncargoespecifico',read_only=True)
    new_grado = gradoSerializer(source='gradoid',read_only=True)
    new_tiponomina = TipoNominaSerializer(source='tiponomina',read_only=True)
    new_Dependencia = DependenciaSerializer(source='DependenciasId',read_only=True)
    new_DireccionGeneral = DireccionGeneralSerializer(source='DireccionGeneralid',read_only=True)
    new_DireccionLinea = DireccionLineaSerializer(source='DireccionLineaid',read_only=True)
    new_Coordinacion= CoordinacionSerializer(source='Coordinacionid',read_only=True)

    class Meta:
        model = EmployeeMovementHistory
        fields = [
            'id', 'codigo_puesto', 'fecha_movimiento', 'modificado_por_usuario', 'cedula_analista',
            'motivo_movimiento','new_estatus','new_tipoPersonal',
            'new_denominacioncargo', 'new_denominacioncargoespecifico', 'new_grado', 
            'new_tiponomina','new_Dependencia' ,'new_DireccionGeneral', 'new_DireccionLinea', 'new_Coordinacion'
        ]
        
    def get_modificado_por_usuario(self, obj):
        try:
            empleado = obj.ejecutado_por.cedula
            return f"{empleado.nombres} {empleado.apellidos}".strip()
        except AttributeError:
            return "Analista no encontrado"

    def to_representation(self, instance):
        representation = super().to_representation(instance)

        prev = EmployeeMovementHistory.objects.filter(
            empleado=instance.empleado,
            fecha_movimiento__lt=instance.fecha_movimiento
        ).select_related(
            'denominacioncargo', 'denominacioncargoespecifico', 'gradoid',
            'tiponomina', 'DependenciasId','DireccionGeneralid', 'DireccionLineaid', 'Coordinacionid','estatus', 'tipo_personal'
        ).order_by('-fecha_movimiento').first()

        representation.update({
            'prev_estatus': EstatusSerializer(prev.estatus).data if prev else None,
            'prev_tipoPersonal': TipoPersonalSerializer(prev.tipo_personal).data if prev else None,
            'prev_denominacioncargo': denominacionCargoSerializer(prev.denominacioncargo).data if prev else None,
            'prev_denominacioncargoespecifico': denominacionCargoEspecificoSerializer(prev.denominacioncargoespecifico).data if prev else None,
            'prev_grado': gradoSerializer(prev.gradoid).data if prev and prev.gradoid else None,
            'prev_tiponomina': TipoNominaSerializer(prev.tiponomina).data if prev else None,
            'prev_Dependencia': DependenciaSerializer(prev.DependenciasId).data if prev and prev.DependenciasId else None,
            'prev_DireccionGeneral': DireccionGeneralSerializer(prev.DireccionGeneralid).data if prev and prev.DireccionGeneralid else None,
            'prev_DireccionLinea': DireccionLineaSerializer(prev.DireccionLineaid).data if prev and prev.DireccionLineaid else None,
            'prev_Coordinacion': CoordinacionSerializer(prev.Coordinacionid).data if prev and prev.Coordinacionid else None,
        })

        return representation


class PrestamoCargoSerializer(serializers.ModelSerializer):
    cargo_info = serializers.SerializerMethodField()
    motivo_nombre = serializers.CharField(source='motivo.movimiento', read_only=True)
    estatus_nombre = serializers.CharField(source='estatus.estatus', read_only=True)
    empleado_nombre = serializers.SerializerMethodField()
    empleado_cedula = serializers.SerializerMethodField()
    titular_nombre = serializers.SerializerMethodField()
    titular_cedula = serializers.SerializerMethodField()

    class Meta:
        model = PrestamoCargo
        fields = '__all__'

    def get_cargo_info(self, obj):
        from RAC.serializers.personal_activo_serializers import ListerCodigosSerializer
        return ListerCodigosSerializer(obj.cargo_encargado).data if obj.cargo_encargado else None

    def get_empleado_nombre(self, obj):
        emp = obj.empleado_encargado
        return f"{emp.nombres} {emp.apellidos}" if emp else None

    def get_empleado_cedula(self, obj):
        emp = obj.empleado_encargado
        return emp.cedulaidentidad if emp else None

    def get_titular_nombre(self, obj):
        emp = obj.cargo_encargado.employee
        return f"{emp.nombres} {emp.apellidos}" if emp else None

    def get_titular_cedula(self, obj):
        emp = obj.cargo_encargado.employee
        return emp.cedulaidentidad if emp else None


class PrestamoCargoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrestamoCargo
        fields = [
            'empleado_encargado', 'cargo_encargado', 'motivo',
            'fecha_inicio', 'fecha_fin', 'ejecutado_por'
        ]

    def validate(self, data):
        if data['fecha_fin'] < data['fecha_inicio']:
            raise serializers.ValidationError(
                {'fecha_fin': 'La fecha de fin no puede ser anterior a la fecha de inicio'}
            )
        return data


class PrestamoCargoUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrestamoCargo
        fields = ['fecha_fin', 'motivo']