"""
Serializers de Presentación de Pasivos.
"""
from rest_framework import serializers

# Reutilizados de `core.presentation.serializers` (patrón R-02 / B16): un
# pasivo también es un `Employee`, y su expediente tiene exactamente la
# misma forma — no se duplican estos serializers ni se importan de otro módulo.
from core.presentation.serializers.expediente_lectura import (
    AntecedenteServicioLecturaSerializer,
    ContactoEmergenciaLecturaSerializer,
    ContratoLecturaSerializer,
    DatosViviendaLecturaSerializer,
    FormacionAcademicaLecturaSerializer,
    FormacionComplementariaLecturaSerializer,
    PerfilFisicoLecturaSerializer,
    PerfilSaludLecturaSerializer,
)


class CargoEgresadoSerializer(serializers.Serializer):
    codigo = serializers.CharField(read_only=True)
    denominacioncargo_id = serializers.IntegerField(read_only=True)
    denominacioncargo_nombre = serializers.CharField(read_only=True)
    denominacioncargoespecifico_id = serializers.IntegerField(read_only=True)
    denominacioncargoespecifico_nombre = serializers.CharField(read_only=True)
    grado_id = serializers.IntegerField(read_only=True, allow_null=True)
    grado_nombre = serializers.CharField(read_only=True, allow_null=True)
    tipo_nomina_id = serializers.IntegerField(read_only=True)
    tipo_nomina_nombre = serializers.CharField(read_only=True)
    tipo_personal_id = serializers.IntegerField(read_only=True)
    tipo_personal_nombre = serializers.CharField(read_only=True)
    dependencia_id = serializers.IntegerField(read_only=True)
    dependencia_nombre = serializers.CharField(read_only=True)
    direccion_general_id = serializers.IntegerField(read_only=True, allow_null=True)
    direccion_general_nombre = serializers.CharField(read_only=True, allow_null=True)
    direccion_linea_id = serializers.IntegerField(read_only=True, allow_null=True)
    direccion_linea_nombre = serializers.CharField(read_only=True, allow_null=True)
    coordinacion_id = serializers.IntegerField(read_only=True, allow_null=True)
    coordinacion_nombre = serializers.CharField(read_only=True, allow_null=True)
    organismo_adscrito_id = serializers.IntegerField(read_only=True, allow_null=True)
    organismo_adscrito_nombre = serializers.CharField(read_only=True, allow_null=True)


class PasivoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    cedula = serializers.CharField(read_only=True)
    nombres = serializers.CharField(read_only=True)
    apellidos = serializers.CharField(read_only=True)
    nombre_completo = serializers.CharField(read_only=True)
    tipo_pasivo = serializers.CharField(read_only=True)
    tipo_nomina_id = serializers.IntegerField(read_only=True, allow_null=True)
    fecha_egreso = serializers.CharField(read_only=True, allow_null=True)
    resolucion = serializers.CharField(read_only=True, allow_null=True)
    observaciones = serializers.CharField(read_only=True, allow_null=True)
    correo = serializers.CharField(read_only=True, allow_null=True)
    telefono_movil = serializers.CharField(read_only=True, allow_null=True)
    telefono_habitacion = serializers.CharField(read_only=True, allow_null=True)
    carnet_patria = serializers.CharField(read_only=True, allow_null=True)
    fecha_nacimiento = serializers.CharField(read_only=True, allow_null=True)
    estado_civil_id = serializers.IntegerField(read_only=True, allow_null=True)
    nacionalidad_id = serializers.IntegerField(read_only=True, allow_null=True)
    # Expediente anidado: solo viene poblado en el detalle
    # (`GET /api/v1/pasivos/<cedula>/`), el listado lo deja vacío.
    datos_vivienda = DatosViviendaLecturaSerializer(read_only=True, allow_null=True)
    perfil_salud = PerfilSaludLecturaSerializer(read_only=True, allow_null=True)
    perfil_fisico = PerfilFisicoLecturaSerializer(read_only=True, allow_null=True)
    formacion_academica = FormacionAcademicaLecturaSerializer(read_only=True, many=True)
    formacion_complementaria = FormacionComplementariaLecturaSerializer(read_only=True, many=True)
    contacto_emergencia = ContactoEmergenciaLecturaSerializer(read_only=True, many=True)
    antecedentes = AntecedenteServicioLecturaSerializer(read_only=True, many=True)
    contrato_actual = ContratoLecturaSerializer(read_only=True, allow_null=True)
    cargos_historial = CargoEgresadoSerializer(read_only=True, many=True)


class ProcesarEgresoInputSerializer(serializers.Serializer):
    """Transición activo → pasivo (Fase 2.1, `PLAN_REPARACION_GATH.md`)."""

    motivo_movimiento_id = serializers.IntegerField(required=True)
    tipo_nomina_id = serializers.IntegerField(required=True)
    liberar_activos = serializers.BooleanField(required=False, default=True)
    sobrevivientes_familiar_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
        help_text='C20: familiares a dar de alta como pensionados por sobrevivencia (motivo fallecimiento).',
    )


class CrearSobrevivientesInputSerializer(serializers.Serializer):
    """C20: alta de pensionados por sobrevivencia de un titular fallecido."""

    tipo_nomina_id = serializers.IntegerField(
        required=False, allow_null=True, default=None,
        help_text='Debe ser una nómina de pensión por sobrevivencia; si se omite se usa la del catálogo.',
    )
    familiar_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=False,
        help_text='Si se omite, se usan los familiares marcados como herederos.',
    )


class ResultadoSobrevivienteSerializer(serializers.Serializer):
    cedula = serializers.CharField(read_only=True)
    nombre_completo = serializers.CharField(read_only=True)
    creado = serializers.BooleanField(read_only=True)
    codigo_asignacion = serializers.CharField(read_only=True, allow_null=True)


class PasivoEgresoInputSerializer(serializers.Serializer):
    """Egreso de un pasivo (fallecimiento) y sobrevivientes opcionales."""

    motivo_id = serializers.IntegerField(required=True)
    sobrevivientes_familiar_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
    )


class PasivoCrearInputSerializer(serializers.Serializer):
    """Alta directa de jubilado/pensionado (permiso `pasivos.crear`)."""

    cedula = serializers.CharField(required=True, max_length=20)
    nombres = serializers.CharField(required=True, max_length=150)
    apellidos = serializers.CharField(required=True, max_length=150)
    sexo_id = serializers.IntegerField(required=True)
    fecha_nacimiento = serializers.DateField(required=True)
    tipo_nomina_id = serializers.IntegerField(required=True)
    estado_civil_id = serializers.IntegerField(required=False, allow_null=True)
    nacionalidad_id = serializers.IntegerField(required=False, allow_null=True)
    correo = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    telefono_movil = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=20)
    telefono_habitacion = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=20)
    carnet_patria = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=30)
    datos_vivienda = serializers.DictField(required=False)
    perfil_salud = serializers.DictField(required=False)
    perfil_fisico = serializers.DictField(required=False)
    formacion_academica = serializers.ListField(child=serializers.DictField(), required=False)
    formacion_complementaria = serializers.ListField(child=serializers.DictField(), required=False)
    contacto_emergencia = serializers.ListField(child=serializers.DictField(), required=False)
    antecedentes = serializers.ListField(child=serializers.DictField(), required=False)
    contrato = serializers.ListField(child=serializers.DictField(), required=False)

    def validate_nombres(self, value):
        return value.upper() if value else value

    def validate_apellidos(self, value):
        return value.upper() if value else value


class PasivoListaInputSerializer(serializers.Serializer):
    """Filtros del listado paginado de pasivos."""

    cedula = serializers.CharField(required=False, allow_blank=True)
    nombre = serializers.CharField(required=False, allow_blank=True)
    tipo_nomina_id = serializers.IntegerField(required=False, allow_null=True)
    fecha_desde = serializers.DateField(required=False, allow_null=True)
    fecha_hasta = serializers.DateField(required=False, allow_null=True)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=50, default=10)
    offset = serializers.IntegerField(required=False, min_value=0, default=0)


class PasivoActualizarInputSerializer(serializers.Serializer):
    """Campos básicos editables de un pasivo (permiso `pasivos.editar`)."""

    nombres = serializers.CharField(required=False, max_length=150)
    apellidos = serializers.CharField(required=False, max_length=150)
    correo = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    telefono_movil = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=20)
    telefono_habitacion = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=20)
    carnet_patria = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=30)
    fecha_nacimiento = serializers.DateField(required=False, allow_null=True)
    estado_civil_id = serializers.IntegerField(required=False, allow_null=True)
    nacionalidad_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_nombres(self, value):
        return value.upper() if value else value

    def validate_apellidos(self, value):
        return value.upper() if value else value
