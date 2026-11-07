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
from core.domain.limites_texto import DIRECCION_MIN, DIRECCION_MAX as _DIRECCION_MAX, mensajes_texto
import re
from datetime import date

from rest_framework import serializers

from core.infrastructure.serializer_mixins import CleanZerosMixin
from core.presentation.validadores_personas import (
    validar_cedula,
    validar_drf,
    validar_nombre,
    validar_serial_carnet_patria,
    validar_telefono,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    NacionalidadModel,
    PaisModel,
    SexoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    DiscapacidadModel,
    PatologiaCronicaModel,
    PoliticaModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContactoEmergenciaModel,
    DatosViviendaModel,
    FormacionAcademicaModel,
    FormacionComplementariaModel,
    PerfilFisicoModel,
    PerfilSaludModel,
)


# Longitudes del expediente (mismas que el formulario de NextJS, `schema-empleado.ts`).
CEDULA_MIN, CEDULA_MAX = 5, 9
NOMBRE_MIN, NOMBRE_MAX = 2, 60
DIRECCION_MAX = _DIRECCION_MAX
CORREO_MAX = 254


def _validar_cedula_6_9(value, etiqueta='La cédula'):
    limpia = validar_drf(validar_cedula, value, etiqueta=etiqueta)
    if limpia and not (CEDULA_MIN <= len(limpia) <= CEDULA_MAX):
        raise serializers.ValidationError(f'{etiqueta} debe tener entre {CEDULA_MIN} y {CEDULA_MAX} dígitos.')
    return limpia


def _validar_nombre_2_60(value, *, edicion: bool, etiqueta: str):
    limpio = validar_drf(validar_nombre, value, edicion=edicion, etiqueta=etiqueta)
    if limpio is not None and not (NOMBRE_MIN <= len(limpio) <= NOMBRE_MAX):
        raise serializers.ValidationError(f'{etiqueta} debe tener entre {NOMBRE_MIN} y {NOMBRE_MAX} caracteres.')
    return limpio


def _validar_codigo_carnet(value):
    """Código del Carnet de la Patria: 10 dígitos (se toleran guiones y espacios del legado).

    El formato legado ``000-0000000-0`` trae un dígito verificador al final que
    no forma parte del código: se descarta para quedarse con los 10 dígitos.
    """
    if value is None:
        return None
    texto = str(value).strip()
    limpio = ''.join(ch for ch in texto if ch not in ' -')
    if not limpio:
        return ''
    if re.fullmatch(r'\d{3}-\d{7}-\d', texto):
        limpio = limpio[:10]
    if not (limpio.isascii() and limpio.isdigit() and len(limpio) == 10):
        raise serializers.ValidationError('El código del Carnet de la Patria debe tener 10 dígitos.')
    return limpio


class DatosViviendaEscrituraSerializer(serializers.ModelSerializer):
    pais = serializers.PrimaryKeyRelatedField(
        queryset=PaisModel.objects.all(), required=False, allow_null=True,
    )
    ciudad_region = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=120,
    )
    direccion_exacta = serializers.CharField(
        min_length=DIRECCION_MIN, max_length=DIRECCION_MAX,
        error_messages=mensajes_texto('La dirección', DIRECCION_MIN, DIRECCION_MAX),
    )

    class Meta:
        model = DatosViviendaModel
        fields = [
            'pais', 'ciudad_region', 'estado', 'municipio', 'parroquia',
            'direccion_exacta', 'condicion_vivienda', 'codigo_postal',
        ]

    def validate(self, attrs):
        instance = self.instance
        pais = attrs.get('pais', getattr(instance, 'pais', None))
        if pais is None:
            pais = PaisModel.objects.filter(es_venezuela=True).first() or PaisModel.objects.filter(
                codigo='VE',
            ).first()
        # Entornos sin el seed (por ejemplo pruebas con --nomigrations): se
        # conserva el comportamiento actual de Venezuela.
        es_venezuela = True if pais is None else bool(pais.es_venezuela)
        if es_venezuela:
            for campo in ('estado', 'municipio', 'parroquia', 'codigo_postal'):
                if not attrs.get(campo, getattr(instance, campo, None)):
                    raise serializers.ValidationError({
                        campo: 'Este campo es obligatorio para Venezuela.',
                    })
            attrs['ciudad_region'] = ''
        else:
            ciudad = ' '.join(
                (attrs.get('ciudad_region') or getattr(
                    instance, 'ciudad_region', '',
                ) or '').split()
            )
            if not ciudad:
                raise serializers.ValidationError({
                    'ciudad_region': 'Indique la ciudad o región.',
                })
            if len(ciudad) > 120:
                raise serializers.ValidationError({
                    'ciudad_region': 'La ciudad o región no puede superar 120 caracteres.',
                })
            attrs['ciudad_region'] = ciudad
            for campo in ('estado', 'municipio', 'parroquia', 'codigo_postal'):
                attrs[campo] = None
        attrs['pais'] = pais
        return attrs


class PerfilSaludEscrituraSerializer(serializers.ModelSerializer):
    alergias = serializers.PrimaryKeyRelatedField(
        many=True, queryset=AlergiaModel.objects.all(), required=False
    )
    patologiaCronica = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PatologiaCronicaModel.objects.all(), required=False
    )
    discapacidad = serializers.PrimaryKeyRelatedField(
        many=True, queryset=DiscapacidadModel.objects.all(), required=False
    )

    class Meta:
        model = PerfilSaludModel
        fields = ['grupo_sanguineo', 'alergias', 'patologiaCronica', 'discapacidad']

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.copy()
            if 'patologias_cronicas' in data and 'patologiaCronica' not in data:
                data['patologiaCronica'] = data.pop('patologias_cronicas')
            if 'discapacidades' in data and 'discapacidad' not in data:
                data['discapacidad'] = data.pop('discapacidades')
            for key in ('alergias', 'patologiaCronica', 'discapacidad'):
                if key in data and data[key] is None:
                    data[key] = []
        return super().to_internal_value(data)


class PerfilFisicoEscrituraSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerfilFisicoModel
        fields = ['tallaCamisa', 'tallaPantalon', 'tallaZapatos', 'tallaChaqueta']


class FormacionComplementariaEscrituraSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormacionComplementariaModel
        fields = ['capacitacion', 'institucion', 'fechaInicio', 'fechaFin', 'dias_completados', 'horas_completadas', 'procedencia', 'grupo']


class FormacionAcademicaEscrituraSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormacionAcademicaModel
        fields = ['nivel_academico', 'carrera', 'mencion', 'institucion']


class ContactoEmergenciaEscrituraSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactoEmergenciaModel
        fields = ['nombres', 'apellidos', 'telefono', 'relacion']

    def validate_telefono(self, value):
        return validar_drf(validar_telefono, value)

    def validate_nombres(self, value):
        return _validar_nombre_2_60(value, edicion=False, etiqueta='El nombre del contacto')

    def validate_apellidos(self, value):
        return _validar_nombre_2_60(value, edicion=False, etiqueta='El apellido del contacto')


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
    correo = serializers.EmailField(required=False, allow_null=True, max_length=CORREO_MAX)
    # Vive en autogestión (datos complementarios del trabajador); el repositorio lo guarda allí.
    correo_alternativo = serializers.EmailField(
        required=False, allow_null=True, allow_blank=True, max_length=CORREO_MAX,
    )
    telefono_movil = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    telefono_habitacion = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    estado_civil_id = serializers.PrimaryKeyRelatedField(
        queryset=EstadoCivilModel.objects.all(), required=False, allow_null=True,
    )
    nacionalidad_id = serializers.PrimaryKeyRelatedField(
        queryset=NacionalidadModel.objects.all(), required=False, allow_null=True,
    )
    carnet_patria = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=30)
    carnet_patria_serial = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=30)


    datos_vivienda = DatosViviendaEscrituraSerializer(required=False)
    perfil_salud = PerfilSaludEscrituraSerializer(required=False)
    perfil_fisico = PerfilFisicoEscrituraSerializer(required=False)
    formacion_academica = FormacionAcademicaEscrituraSerializer(many=True, required=False)
    formacion_complementaria = FormacionComplementariaEscrituraSerializer(many=True, required=False)
    contacto_emergencia = ContactoEmergenciaEscrituraSerializer(many=True, required=False)
    antecedentes = AntecedenteServicioEscrituraSerializer(many=True, required=False)
    contrato = ContratoEscrituraSerializer(many=True, required=False)

    def validate_cedula(self, value):
        if self.instance and self.instance.cedulaidentidad != value:
            raise serializers.ValidationError('La cédula de identidad no puede ser modificada.')
        return value

    def validate_carnet_patria_serial(self, value):
        return validar_drf(validar_serial_carnet_patria, value)

    def validate_telefono_movil(self, value):
        return validar_drf(validar_telefono, value, tipo='movil')

    def validate_telefono_habitacion(self, value):
        return validar_drf(validar_telefono, value)

    # Al editar se tolera el punto de las iniciales del legado ("JOSE A.").
    nombre_de_edicion = False

    def validate_carnet_patria(self, value):
        return _validar_codigo_carnet(value)

    def validate_nombres(self, value):
        limpio = _validar_nombre_2_60(value, edicion=self.nombre_de_edicion, etiqueta='El nombre')
        return limpio.upper() if limpio else limpio

    def validate_apellidos(self, value):
        limpio = _validar_nombre_2_60(value, edicion=self.nombre_de_edicion, etiqueta='El apellido')
        return limpio.upper() if limpio else limpio

    def validate_fecha_nacimiento(self, value):
        if not value:
            return value
        hoy = date.today()
        edad = hoy.year - value.year - ((hoy.month, hoy.day) < (value.month, value.day))
        if edad <= 15:
            raise serializers.ValidationError('El empleado debe ser mayor de 15 años.')
        return value

    def validate(self, attrs):
        correo = (attrs.get('correo') or '').strip().lower()
        alternativo = (attrs.get('correo_alternativo') or '').strip().lower()
        cedula = (
            attrs.get('cedula')
            or (self.context.get('view').kwargs.get('cedula') if self.context.get('view') and hasattr(self.context['view'], 'kwargs') else None)
            or (self.context.get('cedula'))
        )
        propio_correo = ''
        propio_alternativo = ''
        if cedula:
            propio_emp = EmployeeModel.objects.filter(
                cedulaidentidad=str(cedula).strip()
            ).first()
            if propio_emp:
                propio_correo = (propio_emp.correo or '').strip().lower()
            from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
            propio_alt = DatosComplementariosTrabajadorModel.objects.filter(
                cedula=str(cedula).strip()
            ).values_list('correo_alternativo', flat=True).first()
            if propio_alt:
                propio_alternativo = (propio_alt or '').strip().lower()

        if not correo and propio_correo:
            correo = propio_correo

        if alternativo:
            if correo and correo == alternativo:
                raise serializers.ValidationError({
                    'correo_alternativo': 'El correo alternativo debe ser distinto del institucional.',
                })
            # Validar unicidad solo si el alternativo cambió (FIX-AUD6 / FIX-QA11)
            if not propio_alternativo or alternativo != propio_alternativo:
                if EmployeeModel.objects.filter(correo__iexact=alternativo).exists():
                    raise serializers.ValidationError({
                        'correo_alternativo': 'El correo alternativo ya está en uso como correo institucional.',
                    })
                from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
                qs_alt = DatosComplementariosTrabajadorModel.objects.filter(correo_alternativo__iexact=alternativo)
                if cedula:
                    qs_alt = qs_alt.exclude(cedula=str(cedula).strip())
                if qs_alt.exists():
                    raise serializers.ValidationError({
                        'correo_alternativo': 'El correo alternativo ya está en uso por otro trabajador.',
                    })

        if correo and attrs.get('correo'):
            # Validar institucional solo si cambió
            if not propio_correo or correo != propio_correo:
                qs_emp = EmployeeModel.objects.filter(correo__iexact=correo)
                if cedula:
                    qs_emp = qs_emp.exclude(cedulaidentidad=str(cedula).strip())
                if qs_emp.exists():
                    raise serializers.ValidationError({
                        'correo': 'Ya existe un trabajador con ese correo electrónico.',
                    })
                from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
                qs_alt = DatosComplementariosTrabajadorModel.objects.filter(correo_alternativo__iexact=correo)
                if cedula:
                    qs_alt = qs_alt.exclude(cedula=str(cedula).strip())
                if qs_alt.exists():
                    raise serializers.ValidationError({
                        'correo': 'El correo institucional no puede coincidir con un correo alternativo registrado.',
                    })
        return attrs

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
        if 'nacionalidad_id' in validado and validado['nacionalidad_id'] is not None:
            validado['nacionalidad_id'] = validado['nacionalidad_id'].pk
        # Aplanar las M2M de salud a ids (el repo espera listas de ids).
        salud = validado.get('perfil_salud')
        if salud:
            if 'grupo_sanguineo' in salud and salud['grupo_sanguineo'] is not None:
                salud['grupo_sanguineo_id'] = salud.pop('grupo_sanguineo').pk
            for campo, destino in [('alergias', 'alergias'), ('patologiaCronica', 'patologias_cronicas'), ('discapacidad', 'discapacidades')]:
                if campo in salud and salud[campo] is not None:
                    salud[destino] = [i.pk for i in salud.pop(campo)]
        # Aplanar las FK de perfil físico a ids (repo espera *_id plano).
        fisico = validado.get('perfil_fisico')
        if fisico:
            for campo, destino in [('tallaCamisa', 'talla_camisa_id'), ('tallaPantalon', 'talla_pantalon_id'), ('tallaZapatos', 'talla_zapatos_id'), ('tallaChaqueta', 'talla_chaqueta_id')]:
                if campo in fisico and fisico[campo] is not None:
                    fisico[destino] = fisico.pop(campo).pk
        return validado


class EmpleadoCrearSerializer(EmpleadoEscrituraSerializer):
    cedula = serializers.CharField(required=True, max_length=CEDULA_MAX)
    nombres = serializers.CharField(required=True, max_length=NOMBRE_MAX)
    apellidos = serializers.CharField(required=True, max_length=NOMBRE_MAX)
    sexo_id = serializers.PrimaryKeyRelatedField(queryset=SexoModel.objects.all())
    fecha_nacimiento = serializers.DateField(required=True)

    def validate_cedula(self, value):
        return _validar_cedula_6_9(super().validate_cedula(value))

    def to_internal_value(self, data):
        validado = super().to_internal_value(data)
        if 'sexo_id' in validado and validado['sexo_id'] is not None:
            validado['sexo_id'] = validado['sexo_id'].pk
        return validado


class EmpleadoActualizarSerializer(EmpleadoEscrituraSerializer):
    nombre_de_edicion = True

    cedula = serializers.CharField(required=False, max_length=20)
    nombres = serializers.CharField(required=False, max_length=NOMBRE_MAX)
    apellidos = serializers.CharField(required=False, max_length=NOMBRE_MAX)
    sexo_id = serializers.PrimaryKeyRelatedField(queryset=SexoModel.objects.all(), required=False)
    fecha_nacimiento = serializers.DateField(required=False)

    def to_internal_value(self, data):
        validado = super().to_internal_value(data)
        if 'sexo_id' in validado and validado['sexo_id'] is not None:
            validado['sexo_id'] = validado['sexo_id'].pk
        return validado
