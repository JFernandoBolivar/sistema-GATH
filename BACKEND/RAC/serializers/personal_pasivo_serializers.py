
from rest_framework import serializers
from django.utils import timezone
from .catalogs_serializers import *
from ..models.personal_models import *
from RAC.serializers.personal_activo_serializers import *
from .mixins import ContratoMixin


class CodigosCreateUpdatePassiveSerializer(CleanZerosMixin, serializers.ModelSerializer):
    usuario_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), write_only=True)     
    
    class Meta:
        model = AsigTrabajo   
        fields = [
            'usuario_id',
            'codigo',
            'denominacioncargoid',
            'denominacioncargoespecificoid',
            'OrganismoAdscritoid',
            'tiponominaid',
            
        ]
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance:
            self.fields['codigo'].read_only = True

             
    def validate_tiponominaid(self, value):
        if not self.instance or self.instance.tiponominaid != value:
            if value.es_activo:
               raise serializers.ValidationError('Tipo de nómina no permitido')
        return value 
    
    def validate(self, attrs):
        try:
            if not getattr(self, 'instance', None):
               attrs['estatusid'] = Estatus.objects.get(estatus__iexact=ESTATUS_VACANTE)
            attrs['Tipo_personal'] = Tipo_personal.objects.get(tipo_personal__iexact=PERSONAL_PASIVO)
            attrs['Dependencia'] = Dependencias.objects.get(dependencia__iexact="MINISTERIO")
            attrs['DireccionGeneral'] =  DireccionGeneral.objects.get(direccion_general__iexact="OFICINA DE GESTION HUMANA")
        except (Estatus.DoesNotExist, Tipo_personal.DoesNotExist,Dependencias.DoesNotExist,DireccionGeneral.DoesNotExist) as e:
            raise serializers.ValidationError(f"Error de datos: {str(e)}")     
        
        codigo = attrs.get('codigo', getattr(self.instance, 'codigo', None))
        tiponominaid = attrs.get('tiponominaid', getattr(self.instance, 'tiponominaid', None))

        if codigo and tiponominaid:
            queryset = AsigTrabajo.objects.filter(codigo=codigo, tiponominaid=tiponominaid)
            
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            
            if queryset.exists():
                raise serializers.ValidationError(
                     f"Ya existe el código {codigo} para este tipo de nómina"
                )
        return attrs


    @transaction.atomic
    def create(self, validated_data):
        usuario = validated_data.pop('usuario_id')
        instance = AsigTrabajo.objects.create(**validated_data)
      
        instance._history_user = usuario
        instance.save()
            
        return instance
    
    @transaction.atomic
    def update(self, instance, validated_data):
        usuario = validated_data.pop('usuario_id')
        instance._history_user = usuario
        return super().update(instance, validated_data)
class ListerCodigosPassiveSerializer(serializers.ModelSerializer):

    denominacioncargo = denominacionCargoSerializer(
        source='denominacioncargoid', read_only=True
    )
    denominacioncargoespecifico = denominacionCargoEspecificoSerializer(
        source='denominacioncargoespecificoid', read_only=True
    )
    tiponomina =TipoNominaSerializer(source='tiponominaid', read_only=True)
    OrganismoAdscrito = OrganismoAdscritoSerializer(
        source='OrganismoAdscritoid', read_only=True
    )
    
    DireccionGeneral = DireccionGeneralSerializer(read_only=True)
    
    estatusid = EstatusSerializer(read_only=True)

    class Meta:
        model = AsigTrabajo
        fields = [
            'id',
            'codigo',
            'denominacioncargo',
            'denominacioncargoespecifico',
            'tiponomina',
            'OrganismoAdscrito',
            'DireccionGeneral',
            'estatusid',
            'observaciones',
            'fecha_actualizacion',
        ]
class EmployeePasiveDetailSerializer(ContratoMixin, serializers.ModelSerializer):

    sexo = SexoSerializer(source='sexoid', read_only=True)
    estadoCivil = EstadoCivilSerializer(read_only=True)
    datos_vivienda = serializers.SerializerMethodField()
    perfil_salud = serializers.SerializerMethodField()
    contacto_emergencia = serializers.SerializerMethodField()
    perfil_fisico = serializers.SerializerMethodField()
    formacion_academica = serializers.SerializerMethodField()
    anos_apn = serializers.IntegerField(source='total_anos_apn', read_only=True)
    antecedentes = serializers.SerializerMethodField()
    contrato = serializers.SerializerMethodField()

    asignaciones = ListerCodigosPassiveSerializer(source='assignments',many=True,read_only=True)
    encargadurias = serializers.SerializerMethodField()
    total_apn = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 
            'cedulaidentidad', 
            'nombres',
            'apellidos', 
            'profile',
            'fecha_nacimiento',
            'sexo',
            'estadoCivil', 
            'correo',
            'telefono_habitacion',
            'telefono_movil',
            'datos_vivienda', 
            'perfil_salud',
            'contacto_emergencia',
            'perfil_fisico', 
            'formacion_academica',
            'antecedentes',
            'contrato',
            'anos_apn', 
            'fecha_actualizacion', 
            'asignaciones',
            'encargadurias',
            'total_apn'
        ]
    
    def get_datos_vivienda(self, obj):
        vivienda = obj.datos_vivienda_set.first()
        return DatosViviendaSerializer(vivienda).data if vivienda else None

    def get_perfil_salud(self, obj):
        salud = obj.perfil_salud_set.first()
        return PerfilSaludSerializer(salud).data if salud else None
    
    def get_contacto_emergencia(self, obj):
        emergencia = obj.contacto_emergencia_set.first()
        return ContactoEmergenciaSerializer(emergencia).data if emergencia else None

    def get_perfil_fisico(self, obj):
        fisico = obj.perfil_fisico_set.first()
        return PerfilFisicoSerializer(fisico).data if fisico else None
    

    def get_formacion_academica(self, obj):
        academica = obj.formacion_academica_set.first()
        return FormacionAcademicaSerializer(academica).data if academica else None

    def get_antecedentes(self, obj):
        cerrados = obj.antecedentes_servicio_set.filter(fecha_egreso__isnull=False)
        return AntecedentesServicioSerializer(cerrados, many=True).data

    # get_contrato viene del ContratoMixin


    def get_encargadurias(self, obj):
        from datetime import date
        from ..serializers.historial_personal_serializers import PrestamoCargoSerializer
        prestamos = obj.encargadurias_asignadas.filter(
            fecha_fin__gte=date.today()
        ).select_related('cargo_encargado', 'motivo', 'estatus')
        return PrestamoCargoSerializer(prestamos, many=True).data

    def get_total_apn(self, obj):
        from ..utils.tiempo_servicio import calcular_total_apn
        cerrados = obj.antecedentes_servicio_set.filter(fecha_egreso__isnull=False)
        return calcular_total_apn(cerrados)
    
    # ..........................................................
    
   
