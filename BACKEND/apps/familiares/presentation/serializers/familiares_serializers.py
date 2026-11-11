"""
Serializers de Presentación de Familiares.
"""
from datetime import date

from core.domain.limites_texto import OBSERVACION_MIN, OBSERVACION_MAX, mensajes_texto
from rest_framework import serializers

from core.presentation.validadores_personas import validar_cedula, validar_drf, validar_nombre

from apps.familiares.application.use_cases.contexto_validacion_familiar import (
    cedulas_del_familiar,
    heredero_existente,
    parentesco_y_regla,
    sexo_del_familiar,
    titular_del_familiar,
)
from apps.familiares.application.use_cases.validaciones_familiar import (
    ORDEN_HIJO_MAX,
    ORDEN_HIJO_MIN,
    resolver_cedula_familiar,
    validar_cedula_no_duplicada,
    validar_heredero_unico,
    validar_reglas_familiar,
)
from apps.familiares.infrastructure.lector_validacion_familiar_orm import (
    LectorValidacionFamiliarORM,
)
from apps.familiares.infrastructure.modelos_externos import (
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


# Longitudes (mismas que `schema-familiar.ts` en NextJS).
CEDULA_MIN, CEDULA_MAX = 5, 9
NOMBRE_MIN, NOMBRE_MAX = 2, 60
OBSERVACIONES_MAX = OBSERVACION_MAX


def _nombre(value, *, edicion: bool, etiqueta: str):
    limpio = validar_drf(validar_nombre, value, edicion=edicion, etiqueta=etiqueta)
    if limpio and not (NOMBRE_MIN <= len(limpio) <= NOMBRE_MAX):
        raise serializers.ValidationError(f'{etiqueta} debe tener entre {NOMBRE_MIN} y {NOMBRE_MAX} caracteres.')
    return limpio


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
    orden_hijo = serializers.IntegerField(read_only=True, allow_null=True)
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
    primer_nombre = serializers.CharField(required=True, max_length=NOMBRE_MAX)
    segundo_nombre = serializers.CharField(required=False, allow_blank=True, max_length=NOMBRE_MAX)
    primer_apellido = serializers.CharField(required=True, max_length=NOMBRE_MAX)
    segundo_apellido = serializers.CharField(required=False, allow_blank=True, max_length=NOMBRE_MAX)
    cedula_familiar = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)  # sintética '<cédula>-<n>' en edición
    orden_hijo = serializers.IntegerField(
        required=False, allow_null=True,
        min_value=ORDEN_HIJO_MIN, max_value=ORDEN_HIJO_MAX,
        error_messages={'min_value': 'El orden de nacimiento debe ser mayor que cero.'},
    )
    parentesco_id = serializers.IntegerField(required=True)
    fecha_nacimiento = serializers.DateField(required=True)
    sexo_id = serializers.IntegerField(required=True)
    mismo_ente = serializers.BooleanField(required=False, default=False)
    heredero = serializers.BooleanField(required=False, default=False)
    observaciones = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, min_length=OBSERVACION_MIN, max_length=OBSERVACIONES_MAX,
        error_messages=mensajes_texto('Las observaciones', OBSERVACION_MIN, OBSERVACION_MAX),
    )
    perfil_salud = PerfilSaludFamiliarEscrituraSerializer(required=False, allow_null=True)
    perfil_fisico = PerfilFisicoFamiliarEscrituraSerializer(required=False, allow_null=True)
    formacion_academica = FormacionAcademicaFamiliarEscrituraSerializer(required=False, allow_null=True)

    def validate_primer_nombre(self, value):
        return _nombre(value, edicion=self.partial, etiqueta='El primer nombre')

    def validate_segundo_nombre(self, value):
        return _nombre(value, edicion=self.partial, etiqueta='El segundo nombre')

    def validate_primer_apellido(self, value):
        return _nombre(value, edicion=self.partial, etiqueta='El primer apellido')

    def validate_segundo_apellido(self, value):
        return _nombre(value, edicion=self.partial, etiqueta='El segundo apellido')

    def validate_cedula_familiar(self, value):
        if self.partial and value and not value.strip().isdigit():
            # Edición de un registro legado con cédula sintética "<cédula>-<n>": se conserva.
            return value
        limpia = validar_drf(validar_cedula, value, etiqueta='La cédula del familiar')
        if limpia and not (CEDULA_MIN <= len(limpia) <= CEDULA_MAX):
            raise serializers.ValidationError(
                f'La cédula del familiar debe tener entre {CEDULA_MIN} y {CEDULA_MAX} dígitos.'
            )
        return limpia

    def validate_fecha_nacimiento(self, value):
        if value and value > date.today():
            raise serializers.ValidationError('La fecha de nacimiento no puede ser futura.')
        return value

    def validate(self, attrs):
        lector = LectorValidacionFamiliarORM()
        empleado_cedula = attrs.get('empleado_cedula') or self.context.get('empleado_cedula')
        titular = titular_del_familiar(lector, empleado_cedula)
        if titular is None:
            raise serializers.ValidationError({'empleado_cedula': 'Empleado no encontrado.'})
        cedula_empleado = titular.cedula

        excluir_id = self.instance.pk if self.instance else None
        cedula_familiar = (attrs.get('cedula_familiar') or '').strip() or None
        toca_identidad = not self.partial or {
            'cedula_familiar', 'parentesco_id', 'fecha_nacimiento', 'sexo_id',
        } & set(attrs.keys())

        parentesco_id = attrs.get('parentesco_id')
        if parentesco_id is None and self.instance is not None:
            parentesco_id = self.instance.parentesco_id
        parentesco, regla = parentesco_y_regla(lector, parentesco_id)
        if parentesco and not parentesco.aplica_familiar:
            raise serializers.ValidationError(
                {'parentesco_id': 'El parentesco seleccionado no está permitido para familiares.'}
            )
        if not regla.activo:
            raise serializers.ValidationError(
                {'parentesco_id': 'El parentesco seleccionado está desactivado en el catálogo.'}
            )

        fecha_nacimiento = attrs.get('fecha_nacimiento')
        if fecha_nacimiento is None and self.instance is not None:
            fecha_nacimiento = self.instance.fechanacimiento
        sexo_id = attrs.get('sexo_id')
        if sexo_id is None and self.instance is not None:
            sexo_id = self.instance.sexo_id
        if toca_identidad:
            sexo_nombre = None
            if sexo_id is not None:
                sexo_nombre = sexo_del_familiar(lector, sexo_id)
            try:
                validar_reglas_familiar(
                    regla=regla,
                    fecha_nacimiento=fecha_nacimiento,
                    fecha_nacimiento_titular=titular.fecha_nacimiento,
                    sexo=sexo_nombre,
                )
            except ValueError as e:
                campo = 'sexo_id' if 'sexo' in str(e).lower() else 'fecha_nacimiento'
                raise serializers.ValidationError({campo: str(e)})

        if self.instance is not None and getattr(self.instance, 'cedulaFamiliar', None):
            # Editar un familiar existente NO cambia su cédula (aunque se ajuste
            # el orden de nacimiento): las sintéticas ya generadas se respetan.
            attrs['cedula_familiar'] = self.instance.cedulaFamiliar
        elif cedula_familiar or toca_identidad:
            existentes = cedulas_del_familiar(lector, cedula_empleado, excluir_id)
            try:
                cedula_resuelta = resolver_cedula_familiar(
                    cedula_familiar=cedula_familiar,
                    cedula_empleado=cedula_empleado,
                    fecha_nacimiento=fecha_nacimiento,
                    orden_hijo=attrs.get('orden_hijo'),
                    cedulas_existentes=existentes,
                    regla=regla,
                )
                validar_cedula_no_duplicada(cedula_resuelta, existentes)
            except ValueError as e:
                campo = 'orden_hijo' if 'orden' in str(e).lower() else 'cedula_familiar'
                raise serializers.ValidationError({campo: str(e)})
            attrs['cedula_familiar'] = cedula_resuelta

        if attrs.get('heredero'):
            try:
                validar_heredero_unico(True, heredero_existente(lector, cedula_empleado, excluir_id))
            except ValueError as e:
                raise serializers.ValidationError({'heredero': str(e)})

        return attrs


class DocumentoFamiliarSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    familiar_id = serializers.IntegerField(read_only=True)
    tipo_documento = serializers.CharField(read_only=True)
    ruta_archivo = serializers.CharField(read_only=True)
    fecha_subida = serializers.CharField(read_only=True)
