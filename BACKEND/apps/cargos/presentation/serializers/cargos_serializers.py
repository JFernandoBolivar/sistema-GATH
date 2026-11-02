"""
Serializers de Presentación de Cargos.
"""
from rest_framework import serializers


class DenominacionSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(read_only=True)
    orden = serializers.IntegerField(read_only=True)


class DenominacionWriteSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=200, required=True)
    orden = serializers.IntegerField(required=False, default=30)


class CargoAsignacionSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    codigo = serializers.CharField(read_only=True)
    empleado_cedula = serializers.CharField(read_only=True, allow_null=True)
    empleado_nombre = serializers.CharField(read_only=True, allow_null=True)
    denominacion_id = serializers.IntegerField(read_only=True)
    denominacion_nombre = serializers.CharField(read_only=True)
    especifica_id = serializers.IntegerField(read_only=True)
    especifica_nombre = serializers.CharField(read_only=True)
    tipo_nomina_id = serializers.IntegerField(read_only=True)
    tipo_nomina_nombre = serializers.CharField(read_only=True)
    estatus_id = serializers.IntegerField(read_only=True)
    estatus_nombre = serializers.CharField(read_only=True)
    dependencia_id = serializers.IntegerField(read_only=True, allow_null=True)
    dependencia_nombre = serializers.CharField(read_only=True, allow_null=True)
    direccion_general_id = serializers.IntegerField(read_only=True, allow_null=True)
    direccion_general_nombre = serializers.CharField(read_only=True, allow_null=True)
    direccion_linea_id = serializers.IntegerField(read_only=True, allow_null=True)
    direccion_linea_nombre = serializers.CharField(read_only=True, allow_null=True)
    coordinacion_id = serializers.IntegerField(read_only=True, allow_null=True)
    coordinacion_nombre = serializers.CharField(read_only=True, allow_null=True)
    organismo_id = serializers.IntegerField(read_only=True, allow_null=True)
    organismo_nombre = serializers.CharField(read_only=True, allow_null=True)
    grado_id = serializers.IntegerField(read_only=True, allow_null=True)
    grado_nombre = serializers.CharField(read_only=True, allow_null=True)
    observaciones = serializers.CharField(read_only=True, allow_null=True)
    esta_vacante = serializers.BooleanField(read_only=True)
    fecha_actualizacion = serializers.CharField(read_only=True, allow_null=True)


class ActualizarCargoInputSerializer(serializers.Serializer):
    """Serializer para actualizar atributos de un cargo existente."""
    denominacioncargoid = serializers.IntegerField(required=True)
    denominacioncargoespecificoid = serializers.IntegerField(required=True)
    tiponominaid = serializers.IntegerField(required=True)
    gradoid = serializers.IntegerField(required=False, allow_null=True)
    OrganismoAdscritoid = serializers.IntegerField(required=False, allow_null=True)
    Dependencia = serializers.IntegerField(required=False, allow_null=True)
    DireccionGeneral = serializers.IntegerField(required=False, allow_null=True)
    DireccionLinea = serializers.IntegerField(required=False, allow_null=True)
    Coordinacion = serializers.IntegerField(required=False, allow_null=True)
    # Punto de Cuenta automático (RN-006-01): motivo del cambio cuando esta
    # actualización incluye un cambio real de Dependencia. Opcional porque
    # la mayoría de las actualizaciones de cargo no tocan la Dependencia.
    motivo_id = serializers.IntegerField(required=False, allow_null=True)


class AsignarCargoInputSerializer(serializers.Serializer):
    cedula = serializers.CharField(required=True, max_length=20)
    motivo_id = serializers.IntegerField(required=False, allow_null=True)


class CargaMasivaCargosArchivoSerializer(serializers.Serializer):
    archivo = serializers.FileField()


class CambiarCargoInputSerializer(serializers.Serializer):
    """Fase 2.5 del plan de reparación — traslado de cargo."""
    cargo_nuevo_id = serializers.IntegerField(required=True)
    motivo_id = serializers.IntegerField(required=True)


class GestionarEstatusPuestoInputSerializer(serializers.Serializer):
    """Fase 2.5 del plan de reparación — bloqueo/suspensión de cargo."""
    estatus_id = serializers.IntegerField(required=True)
    motivo_id = serializers.IntegerField(required=True)


class PrestamoCargoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    empleado_encargado_cedula = serializers.CharField(read_only=True)
    empleado_encargado_nombre = serializers.CharField(read_only=True)
    cargo_encargado_id = serializers.IntegerField(read_only=True)
    cargo_encargado_codigo = serializers.CharField(read_only=True)
    cargo_encargado_denominacion = serializers.CharField(read_only=True, default='')
    titular_cedula = serializers.CharField(read_only=True, allow_null=True)
    titular_nombre = serializers.CharField(read_only=True, allow_null=True)
    motivo_id = serializers.IntegerField(read_only=True)
    motivo_nombre = serializers.CharField(read_only=True)
    estatus_id = serializers.IntegerField(read_only=True)
    estatus_nombre = serializers.CharField(read_only=True)
    fecha_inicio = serializers.CharField(read_only=True)
    fecha_fin = serializers.CharField(read_only=True)
    ejecutado_por_id = serializers.IntegerField(read_only=True)
    esta_finalizada = serializers.BooleanField(read_only=True)


class CrearPrestamoInputSerializer(serializers.Serializer):
    cedula_encargado = serializers.CharField(required=True, max_length=20)
    cargo_id = serializers.IntegerField(required=True)
    motivo_id = serializers.IntegerField(required=True)
    fecha_inicio = serializers.DateField(required=True)
    fecha_fin = serializers.DateField(required=True)


class CrearCargoEspecialInputSerializer(serializers.Serializer):
    """
    Input de la asignación de cargo especial (código autogenerable, gap #3).
    Réplica del contrato de `SpecialPositionAutoCreateSerializer` legado.
    """
    cedula_empleado = serializers.CharField(required=True, max_length=20)
    denominacion_id = serializers.IntegerField(required=True)
    especifica_id = serializers.IntegerField(required=True)
    tipo_nomina_id = serializers.IntegerField(required=True)
    dependencia_id = serializers.IntegerField(required=False, allow_null=True)
    direccion_general_id = serializers.IntegerField(required=False, allow_null=True)
    direccion_linea_id = serializers.IntegerField(required=False, allow_null=True)
    coordinacion_id = serializers.IntegerField(required=False, allow_null=True)
    organismo_id = serializers.IntegerField(required=False, allow_null=True)
    grado_id = serializers.IntegerField(required=False, allow_null=True)
    observaciones = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class CrearCargoInputSerializer(serializers.Serializer):
    """
    Input para crear un código de posición vacante (sin empleado), réplica
    del contrato de `CodigoCatalogForm`/`schemaCode` del legado.
    """
    denominacion_id = serializers.IntegerField(required=True)
    especifica_id = serializers.IntegerField(required=True)
    tipo_nomina_id = serializers.IntegerField(required=True)
    dependencia_id = serializers.IntegerField(required=False, allow_null=True)
    direccion_general_id = serializers.IntegerField(required=False, allow_null=True)
    direccion_linea_id = serializers.IntegerField(required=False, allow_null=True)
    coordinacion_id = serializers.IntegerField(required=False, allow_null=True)
    organismo_id = serializers.IntegerField(required=False, allow_null=True)
    grado_id = serializers.IntegerField(required=False, allow_null=True)
    observaciones = serializers.CharField(required=False, allow_blank=True, allow_null=True)
