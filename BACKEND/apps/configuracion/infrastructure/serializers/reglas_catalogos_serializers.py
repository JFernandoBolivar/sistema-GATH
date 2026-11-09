"""
Serializers para Reglas de Catálogos (A5).
"""
from rest_framework import serializers


REGLAS_PARENTESCO = (
    'es_hijo', 'menor_a_cargo', 'sin_cedula_hasta_edad', 'edad_minima',
    'diferencia_minima', 'diferencia_tipo', 'sexo_permitido', 'soporte_sugerido',
    'activo',
)


class ReglaParentescoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    descripcion = serializers.CharField(read_only=True)
    aplica_familiar = serializers.BooleanField()
    # FIX-FAM2: reglas configurables del parentesco.
    es_hijo = serializers.BooleanField(read_only=True)
    menor_a_cargo = serializers.BooleanField(read_only=True)
    sin_cedula_hasta_edad = serializers.IntegerField(read_only=True, allow_null=True)
    edad_minima = serializers.IntegerField(read_only=True, allow_null=True)
    diferencia_minima = serializers.IntegerField(read_only=True, allow_null=True)
    diferencia_tipo = serializers.CharField(read_only=True)
    sexo_permitido = serializers.CharField(read_only=True)
    soporte_sugerido = serializers.CharField(read_only=True)
    activo = serializers.BooleanField(read_only=True)


class ReglaParentescoCamposMixin(serializers.Serializer):
    es_hijo = serializers.BooleanField(required=False)
    menor_a_cargo = serializers.BooleanField(required=False)
    sin_cedula_hasta_edad = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=120,
    )
    edad_minima = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=120,
    )
    diferencia_minima = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=120,
    )
    diferencia_tipo = serializers.ChoiceField(
        choices=['NINGUNA', 'MENOR', 'MAYOR'], required=False,
    )
    sexo_permitido = serializers.ChoiceField(
        choices=['', 'M', 'F'], required=False, allow_blank=True,
    )
    soporte_sugerido = serializers.CharField(
        required=False, allow_blank=True, max_length=120,
    )
    activo = serializers.BooleanField(required=False)


class ActualizarParentescoSerializer(ReglaParentescoCamposMixin):
    descripcion = serializers.CharField(min_length=2, max_length=100, required=False)
    aplica_familiar = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not any(k in attrs for k in ('descripcion', 'aplica_familiar', *REGLAS_PARENTESCO)):
            raise serializers.ValidationError('Debe indicar al menos un campo a actualizar.')
        return attrs


class CrearParentescoSerializer(ReglaParentescoCamposMixin):
    descripcion = serializers.CharField(min_length=2, max_length=100, required=True)
    aplica_familiar = serializers.BooleanField(required=False, default=True)


class CategoriaMotivoItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    categoria = serializers.CharField(read_only=True)


class ReglaMotivoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    movimiento = serializers.CharField(read_only=True)
    categoria_id = serializers.IntegerField(read_only=True)
    categoria_nombre = serializers.CharField(read_only=True)
    es_reservado = serializers.BooleanField(read_only=True)
    activo = serializers.BooleanField(read_only=True)


class CambiarCategoriaMotivoSerializer(serializers.Serializer):
    categoria_id = serializers.IntegerField(required=True)


class ActualizarMotivoSerializer(serializers.Serializer):
    movimiento = serializers.CharField(min_length=3, max_length=100, required=False)
    categoria_id = serializers.IntegerField(required=False)
    activo = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not any(k in attrs for k in ('movimiento', 'categoria_id', 'activo')):
            raise serializers.ValidationError('Debe indicar al menos un campo a actualizar.')
        return attrs


class CrearMotivoSerializer(serializers.Serializer):
    movimiento = serializers.CharField(min_length=3, max_length=100, required=True)
    categoria_id = serializers.IntegerField(required=True)


class ReglaNominaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nomina = serializers.CharField(read_only=True)
    requiere_codig = serializers.BooleanField()
    es_activo = serializers.BooleanField()
    es_reservada = serializers.BooleanField(read_only=True)


class ActualizarNominaSerializer(serializers.Serializer):
    nomina = serializers.CharField(min_length=2, max_length=50, required=False)
    es_activo = serializers.BooleanField(required=False, default=None)
    requiere_codig = serializers.BooleanField(required=False, default=None)

    def validate(self, attrs):
        if (
            attrs.get('nomina') is None
            and attrs.get('es_activo') is None
            and attrs.get('requiere_codig') is None
        ):
            raise serializers.ValidationError(
                'Debe indicar al menos un campo a actualizar (nomina, es_activo o requiere_codig).'
            )
        return attrs


class CrearNominaSerializer(serializers.Serializer):
    nomina = serializers.CharField(min_length=2, max_length=50, required=True)
    es_activo = serializers.BooleanField(required=False, default=True)
    requiere_codig = serializers.BooleanField(required=False, default=False)


class ReglaPaisSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    codigo = serializers.CharField(read_only=True)
    es_venezuela = serializers.BooleanField(read_only=True)


class CrearPaisSerializer(serializers.Serializer):
    nombre = serializers.CharField(min_length=2, max_length=100, required=True)
    codigo = serializers.CharField(min_length=2, max_length=3, required=True)


class ActualizarPaisSerializer(serializers.Serializer):
    nombre = serializers.CharField(min_length=2, max_length=100, required=False)
    codigo = serializers.CharField(min_length=2, max_length=3, required=False)

    def validate(self, attrs):
        if not any(k in attrs for k in ('nombre', 'codigo')):
            raise serializers.ValidationError('Debe indicar al menos un campo a actualizar.')
        return attrs


class ReglaTipoSoporteSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    codigo = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    es_reservado = serializers.BooleanField(read_only=True)
    es_protegido = serializers.BooleanField(read_only=True)
    orden = serializers.IntegerField(read_only=True)


class ReglaChecklistSoporteSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    seccion = serializers.CharField(read_only=True)
    tipo_soporte_id = serializers.IntegerField(read_only=True)
    codigo = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    etiqueta = serializers.CharField(read_only=True)
    permitido = serializers.BooleanField(read_only=True)
    requerido = serializers.BooleanField(read_only=True)
    orden = serializers.IntegerField(read_only=True)


class SeccionSoporteSerializer(serializers.Serializer):
    codigo = serializers.CharField(read_only=True)
    nombre = serializers.CharField(read_only=True)


class CrearTipoSoporteSerializer(serializers.Serializer):
    codigo = serializers.CharField(min_length=2, max_length=40, required=True)
    nombre = serializers.CharField(min_length=2, max_length=100, required=True)
    orden = serializers.IntegerField(required=False, default=0)


class ActualizarTipoSoporteSerializer(serializers.Serializer):
    codigo = serializers.CharField(min_length=2, max_length=40, required=False)
    nombre = serializers.CharField(min_length=2, max_length=100, required=False)
    orden = serializers.IntegerField(required=False)

    def validate(self, attrs):
        if not any(k in attrs for k in ('codigo', 'nombre', 'orden')):
            raise serializers.ValidationError('Debe indicar al menos un campo a actualizar.')
        return attrs


class ItemChecklistSoporteSerializer(serializers.Serializer):
    tipo_soporte_id = serializers.IntegerField(required=True)
    permitido = serializers.BooleanField(required=False, default=True)
    requerido = serializers.BooleanField(required=False, default=False)


class ItemReordenarTipoSoporteSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=True, min_value=1)
    orden = serializers.IntegerField(required=True, min_value=0)


class ReordenarTiposSoporteSerializer(serializers.Serializer):
    ordenes = ItemReordenarTipoSoporteSerializer(many=True, required=False)
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)

    def validate(self, attrs):
        if not attrs.get('ordenes') and not attrs.get('ids'):
            raise serializers.ValidationError('Debe indicar «ordenes» o «ids».')
        return attrs


class ActualizarChecklistSoporteSerializer(serializers.Serializer):
    tipos = ItemChecklistSoporteSerializer(many=True, required=True)


class ReglasCatalogosCompletoSerializer(serializers.Serializer):
    parentescos = ReglaParentescoSerializer(many=True)
    categorias_motivo = CategoriaMotivoItemSerializer(many=True)
    motivos = ReglaMotivoSerializer(many=True)
    nominas = ReglaNominaSerializer(many=True)
    paises = ReglaPaisSerializer(many=True)
    tipos_soporte = ReglaTipoSoporteSerializer(many=True)
    checklist_soporte = ReglaChecklistSoporteSerializer(many=True)
    secciones_soporte = SeccionSoporteSerializer(many=True)
