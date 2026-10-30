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
    fecha_egreso = serializers.CharField(read_only=True, allow_null=True)
    resolucion = serializers.CharField(read_only=True, allow_null=True)
    observaciones = serializers.CharField(read_only=True, allow_null=True)
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
