
    #importaciones de rest framework
from rest_framework import serializers

# importaciones de modelos y utilidades
from django.db import transaction
from datetime import date
from ..models.personal_models import *
from ..models.historial_personal_models import Tipo_movimiento
#importacion de servicios
from ..services.generacion_codigo import generador_codigos, generar_prefijo_nomina 
from ..serializers.catalogs_serializers import *
from ..utils.constants import * 
from datetime import date as date_type
from USER.models.user_models import cuenta as User

from ..services.constants_historial import registrar_historial_movimiento
from ..services.profile_services import (
    upsert_vivienda, upsert_health_profile, upsert_physical_profile,
    upsert_academic_profile, replace_complementaria,
    replace_contacto_emergencia, replace_antecedentes,
    upsert_contrato,
)
from ..serializers.mixins import ContratoMixin
from ..services.dependency_validators import validate_dependency_hierarchy


        

# -------------------------------------------------------------
# serializers para el registro y actualizacion de datos personales 
# -------------------------------------------------------------      

class EmployeeCreateUpdateSerializer(CleanZerosMixin, serializers.ModelSerializer):
    usuario_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), write_only=True)
    fecha_nacimiento =serializers.DateField(
        input_formats=['iso-8601', '%Y-%m-%d','%Y-%m-%dT%H:%M:%S.%fZ']
    )
    contrato = ContratoSerializer(many=True, required=False, write_only=True)
    datos_vivienda = DatosViviendaSerializer(required=False)
    perfil_salud = PerfilSaludSerializer(required=False)
    contacto_emergencia = ContactoEmergenciaSerializer(many=True, required=False)
    perfil_fisico = PerfilFisicoSerializer(required=False)
    formacion_academica = FormacionAcademicaSerializer(many=True,required=False, write_only=True)
    formacion_complementaria = FormacionComplementariaSerializer(many=True,required=False, write_only=True)
    antecedentes = AntecedentesServicioSerializer(many=True, required=False)
    
    
    class Meta:
        model = Employee
        fields = '__all__'
        extra_kwargs = {
            'cedulaidentidad': {'write_only': False}
        }
        
    
    def validate_cedulaidentidad(self, value):
        if self.instance and self.instance.cedulaidentidad != value:
            raise serializers.ValidationError("La cedula de identidad no puede ser modificada")
        return value    
    
    def validate_nombres(self, value): return value.upper() if value else value
    def validate_apellidos(self, value): return value.upper() if value else value

    def validate_fecha_nacimiento(self, value):
        hoy = date.today()
        edad = hoy.year - value.year - ((hoy.month, hoy.day) < (value.month, value.day))
        if edad <= 15:
            raise serializers.ValidationError("El empleado debe ser mayor de 15 años.")
        return value
    
    @transaction.atomic
    def create(self, validated_data):
        usuario_obj = validated_data.pop('usuario_id')
        nested_data = self._pop_nested_data(validated_data)
        
        instance = Employee.objects.create(**validated_data)
        instance._history_user = usuario_obj
        instance.save()

      
        self._handle_nested_data(instance, nested_data)
        return instance
    
    @transaction.atomic
    def update(self, instance, validated_data):
        usuario_obj = validated_data.pop('usuario_id', None)
        if usuario_obj:
            instance._history_user = usuario_obj

        nested_data = self._pop_nested_data(validated_data)
        
        instance = super().update(instance, validated_data)

        self._handle_nested_data(instance, nested_data)
        return instance
    
    def _pop_nested_data(self, validated_data):
        return {
            'vivienda': validated_data.pop('datos_vivienda', None),
            'salud': validated_data.pop('perfil_salud', None),
            'fisico': validated_data.pop('perfil_fisico', None),
            'academico': validated_data.pop('formacion_academica', None),
            'complementaria': validated_data.pop('formacion_complementaria', None),
            'contacto_emergencia': validated_data.pop('contacto_emergencia', None),
            'antecedentes': validated_data.pop('antecedentes', None),
            'contrato': validated_data.pop('contrato', None),
        }

    def _handle_nested_data(self, instance, nested):
        upsert_vivienda(instance, nested.get('vivienda'))
        upsert_health_profile(instance, nested.get('salud'), 'empleado_id')
        upsert_physical_profile(instance, nested.get('fisico'), 'empleado_id')
        upsert_academic_profile(instance, nested.get('academico'), 'empleado_id')
        replace_complementaria(instance, nested.get('complementaria'))
        replace_contacto_emergencia(instance, nested.get('contacto_emergencia'))
        replace_antecedentes(instance, nested.get('antecedentes'))
        upsert_contrato(instance, nested.get('contrato'))

    def validate_contrato(self, value):
        if not value or not self.instance:
            return value

        empleado = self.instance

        contratos_existentes = contratos.objects.filter(
            antecedente_id__empleado_id=empleado
        )
        cantidad_actual = contratos_existentes.count()

        # Regla FIJO: si ya tiene contrato fijo, bloquear cualquier cambio de contrato
        if contratos_existentes.filter(es_fijo=True).exists():
            raise serializers.ValidationError(
                "El empleado tiene contrato FIJO (3er contrato). "
                "No se pueden registrar ni modificar contratos hasta un egreso formal."
            )

        for item in value:
            inicio          = item.get('fecha_ingreso')
            fin             = item.get('fecha_culminacion')
            n_contrato_item = item.get('n_contrato')
            politica_id     = item.get('politica_id')

            # Resolver el objeto politica para usar en validaciones y auto-generación
            if politica_id:
                politica_obj = politicas.objects.filter(
                    id=politica_id if isinstance(politica_id, int) else politica_id.pk
                ).first()
            else:
                politica_obj = None

            # Determinar si el contrato ya existe en BD (actualización vs creación)
            es_nuevo = not contratos.objects.filter(
                n_contrato=n_contrato_item,
                antecedente_id__empleado_id=empleado
            ).exists() if n_contrato_item else True

            if es_nuevo:
                if cantidad_actual >= 3:
                    raise serializers.ValidationError(
                        "El trabajador ya tiene 3 contratos registrados. No se pueden crear más contratos."
                    )

                if not politica_obj:
                    raise serializers.ValidationError(
                        "La política es obligatoria para registrar un contrato."
                    )

                # Verificar contrato activo solo para el 1ro y 2do contrato
                if cantidad_actual < 2:
                    hoy = date_type.today()
                    contrato_activo = contratos_existentes.filter(
                        fecha_culminacion__isnull=True
                    ).first() or contratos_existentes.filter(
                        fecha_culminacion__gt=hoy
                    ).first()
                    if contrato_activo:
                        raise serializers.ValidationError(
                            f"El trabajador ya tiene un contrato activo ({contrato_activo.n_contrato}). "
                            "No se puede crear otro hasta que finalice."
                        )

                # Si el frontend no envió n_contrato, auto-generar con la nomenclatura
                if not n_contrato_item:
                    n_contrato_item = f"{politica_obj.tipo_politica[0].upper()}-{empleado.cedulaidentidad}-{str(cantidad_actual + 1).zfill(2)}"
                    item['n_contrato'] = n_contrato_item

            # El 3er contrato no necesita validación de fechas (siempre fijo)
            if cantidad_actual == 2 and es_nuevo:
                continue

            if not inicio:
                continue
            fin = fin or date_type.today()
            if fin < inicio:
                raise serializers.ValidationError(
                    f"La fecha de culminación no puede ser anterior a la fecha de inicio en el contrato {n_contrato_item}."
                )
            qs = contratos.objects.filter(
                antecedente_id__empleado_id=empleado
            ).exclude(n_contrato=n_contrato_item)
            for other in qs:
                other_inicio = other.fecha_ingreso
                other_fin = other.fecha_culminacion or date_type.today()
                if other_inicio and inicio <= other_fin and fin >= other_inicio:
                    raise serializers.ValidationError(
                        f"El contrato {n_contrato_item} ({inicio} - {fin}) se solapa con el contrato "
                        f"{other.n_contrato} ({other_inicio} - {other_fin})."
                    )
        return value

    def validate_antecedentes(self, value):
        if not value or not isinstance(value, list):
            return value
        hoy = date_type.today()
        for i, item in enumerate(value):
            inicio = item.get('fecha_ingreso')
            fin = item.get('fecha_egreso')
            if not inicio:
                continue
            fin = fin or hoy
            if fin < inicio:
                raise serializers.ValidationError(
                    f"La fecha de egreso no puede ser anterior a la fecha de ingreso en el antecedente {i+1}."
                )
            for j, other in enumerate(value):
                if i == j:
                    continue
                other_inicio = other.get('fecha_ingreso')
                other_fin = other.get('fecha_egreso') or hoy
                if other_inicio and inicio <= other_fin and fin >= other_inicio:
                    raise serializers.ValidationError(
                        f"El antecedente {i+1} ({inicio} - {fin}) se solapa con el antecedente {j+1} ({other_inicio} - {other_fin})."
                    )
        return value
                          
# -------------------------------------------------------------
# serializers para listar datos personales 
# -------------------------------------------------------------  
class EmployeeListSerializer(ContratoMixin, serializers.ModelSerializer):
    sexo = SexoSerializer(source='sexoid', read_only=True)
    estadoCivil = EstadoCivilSerializer(read_only=True)

    datos_vivienda = serializers.SerializerMethodField()
    perfil_salud = serializers.SerializerMethodField()
    perfil_fisico = serializers.SerializerMethodField()
    contacto_emergencia = serializers.SerializerMethodField()
    formacion_academica = FormacionAcademicaSerializer(source='formacion_academica_set', many=True, read_only=True)
    formacion_complementaria = FormacionComplementariaSerializer(source='formacion_complementaria_set', many=True, read_only=True)
    
    antecedentes = serializers.SerializerMethodField()
    contrato = serializers.SerializerMethodField()
    
    
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
            'datos_vivienda',
            'perfil_salud', 
            'perfil_fisico', 
            'formacion_academica',
            'formacion_complementaria',
            'contacto_emergencia',
            'antecedentes',
            'contrato',
            'fecha_actualizacion'
        ]
        
    def get_datos_vivienda(self, obj):
        vivienda = obj.datos_vivienda_set.first() 
        return DatosViviendaSerializer(vivienda).data if vivienda else None

    def get_perfil_salud(self, obj):
        salud = obj.perfil_salud_set.first()
        return PerfilSaludSerializer(salud).data if salud else None

    def get_perfil_fisico(self, obj):
        fisico = obj.perfil_fisico_set.first()
        return PerfilFisicoSerializer(fisico).data if fisico else None
    
    def get_contacto_emergencia(self, obj):
        emergencia = obj.contacto_emergencia_set.first()
        return ContactoEmergenciaSerializer(emergencia).data if emergencia else None


    def get_formacion_academica(self, obj):
        academico = obj.formacion_academica_set.first()
        return FormacionAcademicaSerializer(academico).data if academico else None

    def get_antecedentes(self, obj):
        cerrados = obj.antecedentes_servicio_set.filter(fecha_egreso__isnull=False)
        return AntecedentesServicioSerializer(cerrados, many=True).data

    # get_contrato viene del ContratoMixin

    

# -------------------------------------------------------------
# serializers para el registro y actualizacion de datos de cargo
# -------------------------------------------------------------
# serializers para el registro y actualizacion de datos de cargo
# ------------------------------------------------------------- 


class CodigosCreateUpdateSerializer(CleanZerosMixin, serializers.ModelSerializer):
    usuario_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), write_only=True)     
    
    class Meta:
        model = AsigTrabajo   
        exclude = ['employee',  'Tipo_personal', 'estatusid', 'observaciones']  
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance:
            self.fields['codigo'].read_only = True
        else:
            self.fields['OrganismoAdscritoid'].read_only = True
            self.fields['tipo_procedencia'].read_only = True
             
    def validate_tiponominaid(self, value):
        if not self.instance or self.instance.tiponominaid != value:
            if value.requiere_codig:
               raise serializers.ValidationError('Tipo de nómina no permitido')
        return value 
    
    def validate(self, attrs):
        try:
            if not getattr(self, 'instance', None):
               attrs['estatusid'] = Estatus.objects.get(estatus__iexact=ESTATUS_VACANTE)
            attrs['Tipo_personal'] = Tipo_personal.objects.get(tipo_personal__iexact=PERSONAL_ACTIVO)
        except (Estatus.DoesNotExist, Tipo_personal.DoesNotExist) as e:
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
        
        try:
            validate_dependency_hierarchy(
                dependencia=attrs.get('Dependencia', getattr(self.instance, 'Dependencia', None)),
                direccion_general=attrs.get('DireccionGeneral', getattr(self.instance, 'DireccionGeneral', None)),
                direccion_linea=attrs.get('DireccionLinea', getattr(self.instance, 'DireccionLinea', None)),
                coordinacion=attrs.get('Coordinacion', getattr(self.instance, 'Coordinacion', None)),
            )
        except ValueError as e:
            raise serializers.ValidationError(str(e))

        if self.instance and self.instance.tiponominaid and self.instance.tiponominaid.requiere_codig:
            
            nuevo_grado = attrs.get('grado')
            nueva_nomina = attrs.get('tiponominaid')

            if nuevo_grado is not None and nuevo_grado != self.instance.grado:
                raise serializers.ValidationError("No se permite actualizar el grado cuando es un cargo especial")
            
            if nueva_nomina is not None and nueva_nomina != self.instance.tiponominaid:
                raise serializers.ValidationError("No se permite actualizar el tipo de nómina cuando es un cargo especial")
     

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        usuario = validated_data.pop('usuario_id')
        instance = AsigTrabajo.objects.create(**validated_data)
        instance.save()
            
        return instance
    
    @transaction.atomic
    def update(self, instance, validated_data):
        usuario = validated_data.pop('usuario_id')
        return super().update(instance, validated_data)



# -------------------------------------------------------------
# serializers para listar datos de cargo
# -------------------------------------------------------------   
class ListerCodigosSerializer(serializers.ModelSerializer):

    denominacioncargo = denominacionCargoSerializer(
        source='denominacioncargoid', read_only=True
    )
    denominacioncargoespecifico = denominacionCargoEspecificoSerializer(
        source='denominacioncargoespecificoid', read_only=True
    )
    grado = gradoSerializer(source='gradoid', read_only=True)
    tiponomina =TipoNominaGeneralSerializer(source='tiponominaid', read_only=True)
    OrganismoAdscrito = OrganismoAdscritoSerializer(
        source='OrganismoAdscritoid', read_only=True
    )
    tipo_procedencia = TipoProcedenciaSerializers(read_only=True)
    Dependencia = DependenciaSerializer(read_only=True)
    DireccionGeneral = DireccionGeneralSerializer(read_only=True)
    DireccionLinea = DireccionLineaSerializer(read_only=True)
    Coordinacion = CoordinacionSerializer(read_only=True)
    estatusid = EstatusSerializer(read_only=True)

    class Meta:
        model = AsigTrabajo
        fields = [
            'id',
            'codigo',
            'denominacioncargo',
            'denominacioncargoespecifico',
            'grado',
            'tiponomina',
            'OrganismoAdscrito',
            'tipo_procedencia',
            'Dependencia',
            'DireccionGeneral',
            'DireccionLinea',
            'Coordinacion',
            'estatusid',
            'observaciones',
            'fecha_actualizacion',
        ]
      
# -------------------------------------------------------------
# serializers para asignar cargo
# -------------------------------------------------------------         
class EmployeeAssignmentSerializer(serializers.ModelSerializer):
    employee = serializers.SlugRelatedField(
        slug_field='cedulaidentidad',
        queryset=Employee.objects.all(),
        required=True,
        error_messages={
            'required': 'Debe proporcionar la cédula del empleado para realizar la asignación'
        }
    )
    usuario_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        write_only=True,
        required=True
    )

    class Meta:
        model = AsigTrabajo
        fields = ['employee', 'usuario_id']

    def validate(self, attrs):
        if self.instance and self.instance.employee is not None:
            raise serializers.ValidationError("Este código ya está ocupado por el empleado")

        try:
            attrs['estatus_activo'] = Estatus.objects.get(estatus__iexact='ACTIVO')
            attrs['motivo_ingreso'] = Tipo_movimiento.objects.get(movimiento__iexact="ASIGNACION DE CARGO")
        except Estatus.DoesNotExist:
            raise serializers.ValidationError("El estatus 'ACTIVO' no esta en el sistema")
        except Tipo_movimiento.DoesNotExist:
            raise serializers.ValidationError("El motivo 'ASIGNACION DE CARGO' no esta configurado")

        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        usuario = validated_data.pop('usuario_id')
        estatus_activo = validated_data.pop('estatus_activo')
        motivo_ingreso = validated_data.pop('motivo_ingreso')
        nuevo_empleado = validated_data.pop('employee')

        instance.employee = nuevo_empleado
        instance.estatusid = estatus_activo
        instance.save()

        registrar_historial_movimiento(
            empleado=nuevo_empleado,
            puesto=instance,
            tipo_movimiento='INGRESO',
            motivo=motivo_ingreso,
            usuario=usuario
        )

        return instance


# -------------------------------------------------------------
# serializers para asignar cargo especial
# -------------------------------------------------------------     
class SpecialPositionAutoCreateSerializer(CleanZerosMixin, serializers.ModelSerializer):
    usuario_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        write_only=True
    )

    class Meta: 
        model = AsigTrabajo
        exclude = ['Tipo_personal', 'estatusid', 'codigo', 'observaciones']

    def validate_tiponominaid(self, value):
        if not value.requiere_codig:
            raise serializers.ValidationError(
                'Esta nomina no permite generación automática de códigos especiales'
            )
        return value

    def validate(self, attrs):
        try:
            attrs['estatus_obj'] = Estatus.objects.get(estatus__iexact=ESTATUS_ACTIVO)
            attrs['personal_obj'] = Tipo_personal.objects.get(tipo_personal__iexact=PERSONAL_ACTIVO)
            attrs['motivo_obj'] = Tipo_movimiento.objects.get(movimiento__iexact="ASIGNACION DE CARGO")
        except (Estatus.DoesNotExist, Tipo_personal.DoesNotExist, Tipo_movimiento.DoesNotExist) as e:
            raise serializers.ValidationError(f"Error de configuración: {str(e)}")

        tipo_nomina = attrs.get('tiponominaid')
        try:
            prefix = generar_prefijo_nomina(tipo_nomina)
        except ValueError as e:
            raise serializers.ValidationError(str(e))
        attrs['codigo_generado'] = generador_codigos(prefix)

        return attrs 
    
    @transaction.atomic
    def create(self, validated_data):

        usuario = validated_data.pop('usuario_id')
        estatus = validated_data.pop('estatus_obj')
        personal = validated_data.pop('personal_obj')
        motivo = validated_data.pop('motivo_obj')
        codigo = validated_data.pop('codigo_generado')

        validated_data['estatusid'] = estatus
        validated_data['Tipo_personal'] = personal
        validated_data['codigo'] = codigo

        instance = AsigTrabajo.objects.create(**validated_data)
        instance.save()

        registrar_historial_movimiento(
            empleado=instance.employee, 
            puesto=instance,
            tipo_movimiento='INGRESO',
            motivo=motivo,
            usuario=usuario
        )

        return instance   
# -------------------------------------------------------------
# serializers para listar datos de cargo y personales
# ------------------------------------------------------------- 
class EmployeeDetailSerializer(ContratoMixin, serializers.ModelSerializer):

    sexo = SexoSerializer(source='sexoid', read_only=True)
    estadoCivil = EstadoCivilSerializer(read_only=True)
    datos_vivienda = serializers.SerializerMethodField()
    perfil_salud = serializers.SerializerMethodField()
    contacto_emergencia = serializers.SerializerMethodField()
    perfil_fisico = serializers.SerializerMethodField()
    formacion_academica = serializers.SerializerMethodField()
    formacion_complementaria = FormacionComplementariaSerializer(source='formacion_complementaria_set', many=True, read_only=True)
    anos_apn = serializers.IntegerField(source='total_anos_apn', read_only=True)
    antecedentes = serializers.SerializerMethodField()
    contrato = serializers.SerializerMethodField()

    asignaciones = ListerCodigosSerializer(source='assignments',many=True,read_only=True)
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
            'formacion_complementaria',
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
        academica = obj.formacion_academica_set.all()
        return FormacionAcademicaSerializer(academica, many=True).data

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
    
    
    
class CargaMasivaSerializer(serializers.Serializer):
    archivo = serializers.FileField()




class CargosUploadSerializer(serializers.Serializer):
    archivo = serializers.FileField()

