"""
Serializers de la fe de vida: toda entrada (cuerpo y parámetros de consulta) se valida aquí y la salida
se arma con las funciones `a_dict_*` (enums a texto, sin rutas de archivos) para fijar el contrato OpenAPI.
"""
from rest_framework import serializers

from apps.fe_de_vida.application.dtos.fe_de_vida_dtos import (
    DetalleRevision,
    DetalleSolicitud,
    ProcesoVigente,
    VerificacionConstancia,
)
from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.entities.pasivo import PasivoCobertura
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida, ProrrogaProceso
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.domain.value_objects.estados import EstadoProceso, EstadoSolicitud, OrigenEvidencia

ACCIONES_CAMBIO = ('MODIFICAR', 'CREAR')
MAX_CAMBIOS_BORRADOR = 60
MAX_LONGITUD_MOTIVO = 500
MAX_TIPOS = 50
MAX_RECORDATORIOS = 10


# ── Entrada: parámetros de consulta ──
class PaginaSerializer(serializers.Serializer):
    limit = serializers.IntegerField(required=False, min_value=1, help_text='Por defecto 10, máximo 50.')
    offset = serializers.IntegerField(required=False, min_value=0)


class FiltroBandejaSerializer(PaginaSerializer):
    texto = serializers.CharField(required=False, max_length=80, help_text='Cédula o nombre del pasivo.')
    estado = serializers.ChoiceField(required=False, choices=[e.value for e in EstadoSolicitud])
    proceso_id = serializers.UUIDField(required=False)
    desde = serializers.DateField(required=False, help_text='Fecha de envío desde (inclusive).')
    hasta = serializers.DateField(required=False, help_text='Fecha de envío hasta (inclusive).')

    def validate(self, datos):
        if datos.get('desde') and datos.get('hasta') and datos['desde'] > datos['hasta']:
            raise serializers.ValidationError('El rango de fechas es inválido: "desde" es posterior a "hasta".')
        return datos


class FiltroHistorialSerializer(PaginaSerializer):
    estado = serializers.ChoiceField(required=False, choices=[e.value for e in EstadoSolicitud])


class FiltroProcesosSerializer(PaginaSerializer):
    estado = serializers.ChoiceField(required=False, choices=[e.value for e in EstadoProceso])


class FiltroCoberturaSerializer(PaginaSerializer):
    texto = serializers.CharField(required=False, max_length=80, help_text='Cédula o nombre.')
    tipo_nomina_id = serializers.IntegerField(required=False, min_value=1, help_text='Tipo de pensión (TipoNomina).')
    sin_correo = serializers.BooleanField(required=False, default=False)
    sin_cuenta = serializers.BooleanField(required=False, default=False)


# ── Entrada: cuerpos ──
class CambioActaEntradaSerializer(serializers.Serializer):
    seccion = serializers.CharField(max_length=30)
    entidad = serializers.CharField(max_length=40)
    accion = serializers.ChoiceField(choices=ACCIONES_CAMBIO)
    campo = serializers.CharField(max_length=60, help_text="Campo a modificar; '*' al CREAR un registro.")
    valor = serializers.JSONField(allow_null=True)
    entidad_id = serializers.CharField(max_length=32, required=False, allow_null=True, allow_blank=True)


class GuardarBorradorSerializer(serializers.Serializer):
    cambios = CambioActaEntradaSerializer(many=True, max_length=MAX_CAMBIOS_BORRADOR, allow_empty=True)


class SubirEvidenciaSerializer(serializers.Serializer):
    file = serializers.FileField()
    origen = serializers.ChoiceField(choices=[o.value for o in OrigenEvidencia], help_text='CAMARA o ARCHIVO.')
    metadatos = serializers.JSONField(required=False, help_text='Datos de captura (p. ej. dispositivo, resolución).')

    def validate_metadatos(self, valor):
        if not isinstance(valor, dict) or len(str(valor)) > 2000:
            raise serializers.ValidationError('Los metadatos deben ser un objeto pequeño.')
        return valor


class MotivoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=MAX_LONGITUD_MOTIVO)


class JustificacionSerializer(serializers.Serializer):
    justificacion = serializers.CharField(max_length=MAX_LONGITUD_MOTIVO)


class DevolverSerializer(MotivoSerializer):
    requiere_nueva_foto = serializers.BooleanField(
        required=False, default=False, help_text='true: el pasivo debe tomar o subir una foto nueva.',
    )


class _ConfiguracionProcesoMixin(serializers.Serializer):
    tipos_nomina = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, max_length=MAX_TIPOS,
        help_text='Ids de TipoNomina (ver procesos/tipos-pension/). Vacía u omitida = todos los pasivos.',
    )
    dias_recordatorio = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=365), required=False, max_length=MAX_RECORDATORIOS,
        help_text='Días antes del cierre en que se avisa (p. ej. [7, 3, 1]). Vacía u omitida = sin recordatorios.',
    )


class CrearProcesoSerializer(_ConfiguracionProcesoMixin):
    nombre = serializers.CharField(max_length=160)
    fecha_apertura = serializers.DateTimeField()
    fecha_cierre = serializers.DateTimeField()


class EditarProcesoSerializer(_ConfiguracionProcesoMixin):
    """PATCH: solo los campos enviados. En BORRADOR admite todo; ABIERTO, solo `dias_recordatorio`."""

    nombre = serializers.CharField(max_length=160, required=False)
    fecha_apertura = serializers.DateTimeField(required=False)
    fecha_cierre = serializers.DateTimeField(required=False)


class ProrrogarSerializer(serializers.Serializer):
    nueva_fecha_limite = serializers.DateTimeField()
    motivo = serializers.CharField(max_length=MAX_LONGITUD_MOTIVO)
    cedula = serializers.CharField(
        required=False, allow_blank=True, max_length=15,
        help_text='Con cédula: prórroga individual. Vacía u omitida: prórroga general (todos los pasivos).',
    )


# ── Salida ──
class DecisionSerializer(serializers.Serializer):
    tipo = serializers.CharField()
    rol = serializers.CharField()
    actor_cedula = serializers.CharField()
    envio = serializers.IntegerField()
    motivo = serializers.CharField(allow_blank=True)
    fecha = serializers.DateTimeField()
    actor_nombre = serializers.CharField(
        required=False, help_text='Solo en el detalle de revisión: nombre de quien decidió (cédula si no se halla).',
    )


class SolicitudSerializer(serializers.Serializer):
    id = serializers.CharField()
    proceso_id = serializers.CharField()
    cedula = serializers.CharField()
    nombre = serializers.CharField(required=False)
    estado = serializers.CharField()
    version = serializers.IntegerField()
    envios = serializers.IntegerField()
    origen_evidencia = serializers.CharField(allow_null=True)
    tiene_evidencia = serializers.BooleanField()
    via_aprobacion = serializers.CharField(allow_null=True)
    fecha_envio = serializers.DateTimeField(allow_null=True)
    fecha_validacion = serializers.DateTimeField(allow_null=True)
    requiere_nueva_foto = serializers.BooleanField()
    decisiones = DecisionSerializer(many=True)


class CambioSerializer(serializers.Serializer):
    id = serializers.CharField()
    seccion = serializers.CharField()
    accion = serializers.CharField()
    entidad = serializers.CharField()
    entidad_id = serializers.CharField(allow_null=True)
    campo = serializers.CharField()
    valor_anterior = serializers.JSONField(allow_null=True)
    valor_propuesto = serializers.JSONField(allow_null=True)


class CambioComparadoSerializer(CambioSerializer):
    valor_actual = serializers.JSONField(allow_null=True)
    conflicto = serializers.BooleanField(help_text='La ficha cambió desde que el pasivo propuso el valor.')


class DetalleSolicitudSerializer(serializers.Serializer):
    solicitud = SolicitudSerializer()
    cambios = CambioSerializer(many=True)


class DetalleRevisionSerializer(serializers.Serializer):
    solicitud = SolicitudSerializer()
    cambios = CambioComparadoSerializer(many=True)
    proceso_nombre = serializers.CharField(allow_blank=True)
    ficha = serializers.JSONField(
        allow_null=True,
        help_text='Datos actuales del pasivo, solo lectura: {empleado, familiares, datos_complementarios} con el contrato '
                  'de `autogestion/mi-expediente`. Nulo sin el permiso `fe_de_vida.revisar`.',
    )
    acciones_disponibles = serializers.ListField(
        child=serializers.ChoiceField(choices=['dar_check', 'aprobar_directo', 'devolver', 'rechazar', 'retirar_check']),
        help_text='Acciones que el usuario actual puede ejecutar hoy; las decide el dominio.',
    )


class TipoPensionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()


class ProcesoSerializer(serializers.Serializer):
    id = serializers.CharField()
    nombre = serializers.CharField()
    estado = serializers.CharField()
    fecha_apertura = serializers.DateTimeField()
    fecha_cierre = serializers.DateTimeField()
    fecha_cierre_real = serializers.DateTimeField(allow_null=True)
    tipos_nomina = TipoPensionSerializer(many=True, help_text='Alcance; lista vacía = todos los pasivos.')
    dias_recordatorio = serializers.ListField(child=serializers.IntegerField())


class ProcesoVigenteSerializer(serializers.Serializer):
    proceso = ProcesoSerializer()
    solicitud = SolicitudSerializer(allow_null=True)
    puede_enviar = serializers.BooleanField()


class ProrrogaSerializer(serializers.Serializer):
    id = serializers.CharField()
    proceso_id = serializers.CharField()
    cedula = serializers.CharField(allow_blank=True)
    general = serializers.BooleanField()
    nueva_fecha_limite = serializers.DateTimeField()
    motivo = serializers.CharField()
    concedida_por = serializers.CharField()


class PasivoCoberturaSerializer(serializers.Serializer):
    cedula = serializers.CharField()
    nombre_completo = serializers.CharField()
    tipo_nomina = serializers.CharField()
    correo = serializers.CharField(allow_blank=True)
    sin_correo = serializers.BooleanField()
    tiene_cuenta = serializers.BooleanField()


class CertificanteSerializer(serializers.Serializer):
    nombre = serializers.CharField()
    cedula = serializers.CharField()
    rol = serializers.CharField()


class ConstanciaVerificadaSerializer(serializers.Serializer):
    """Verificación interna: datos completos, certificantes y enlace a la solicitud."""

    numero = serializers.CharField()
    emitida_en = serializers.DateTimeField(allow_null=True)
    proceso_nombre = serializers.CharField()
    nombre_completo = serializers.CharField()
    cedula = serializers.CharField(help_text='Cédula completa.')
    estado = serializers.CharField(help_text='Estado de la solicitud.')
    solicitud_id = serializers.UUIDField()
    certificada_por = CertificanteSerializer(many=True)


class ConstanciaPublicaSerializer(serializers.Serializer):
    """Verificación pública: sin certificantes, cédula completa, ids internos ni foto."""

    numero = serializers.CharField()
    emitida_en = serializers.DateTimeField(allow_null=True)
    proceso_nombre = serializers.CharField()
    nombre_completo = serializers.CharField()
    cedula_enmascarada = serializers.CharField(help_text='Dígitos centrales ocultos, p. ej. 10****23.')
    estado = serializers.ChoiceField(choices=['VALIDA'])


def a_cambio_acta(d: dict) -> CambioActa:
    return CambioActa(
        seccion=d['seccion'], accion=d['accion'], entidad_destino=d['entidad'], campo=d['campo'],
        valor_propuesto=d['valor'], entidad_id=d.get('entidad_id') or None,
    )


def pagina(total: int, limite: int, desplazamiento: int, resultados: list) -> dict:
    return {'count': total, 'limit': limite, 'offset': desplazamiento, 'results': resultados}


def a_dict_solicitud(s: SolicitudFeDeVida, nombre: str | None = None, nombres_actores: dict | None = None) -> dict:
    datos = {
        'id': s.id, 'proceso_id': s.proceso_id, 'cedula': s.cedula, 'estado': s.estado.value, 'version': s.version,
        'envios': s.envios, 'origen_evidencia': s.origen_evidencia.value if s.origen_evidencia else None,
        'tiene_evidencia': bool(s.evidencia_clave), 'via_aprobacion': s.via_aprobacion.value if s.via_aprobacion else None,
        'fecha_envio': s.fecha_envio, 'fecha_validacion': s.fecha_validacion,
        'requiere_nueva_foto': s.requiere_nueva_foto,
        'decisiones': [
            {'tipo': d.tipo.value, 'rol': d.rol.value, 'actor_cedula': d.actor_cedula, 'envio': d.envio,
             'motivo': d.motivo, 'fecha': d.fecha,
             **({'actor_nombre': nombres_actores.get(d.actor_cedula, d.actor_cedula)} if nombres_actores is not None else {})}
            for d in s.decisiones
        ],
    }
    if nombre is not None:
        datos['nombre'] = nombre
    return datos


def a_dict_cambio(c: CambioActa) -> dict:
    return {
        'id': c.id, 'seccion': c.seccion, 'accion': c.accion, 'entidad': c.entidad_destino, 'entidad_id': c.entidad_id,
        'campo': c.campo, 'valor_anterior': c.valor_anterior, 'valor_propuesto': c.valor_propuesto,
    }


def a_dict_detalle(d: DetalleSolicitud) -> dict:
    return {'solicitud': a_dict_solicitud(d.solicitud), 'cambios': [a_dict_cambio(c) for c in d.cambios]}


def a_dict_revision(d: DetalleRevision) -> dict:
    return {
        'solicitud': a_dict_solicitud(d.solicitud, d.nombre_pasivo, d.nombres_actores),
        'cambios': [{**a_dict_cambio(c.cambio), 'valor_actual': c.valor_actual, 'conflicto': c.conflicto} for c in d.cambios],
        'proceso_nombre': d.proceso_nombre, 'ficha': d.ficha, 'acciones_disponibles': list(d.acciones),
    }


def a_dict_proceso(p: ProcesoFeDeVida, nombres_tipos: dict[int, str] | None = None) -> dict:
    """`nombres_tipos` (id -> nombre) los resuelve la vista por consulta; sin nombre se devuelve el id como texto."""
    nombres = nombres_tipos or {}
    return {
        'id': p.id, 'nombre': p.nombre, 'estado': p.estado.value, 'fecha_apertura': p.fecha_apertura,
        'fecha_cierre': p.fecha_cierre, 'fecha_cierre_real': p.fecha_cierre_real,
        'tipos_nomina': [{'id': t, 'nombre': nombres.get(t, str(t))} for t in p.tipos_nomina],
        'dias_recordatorio': list(p.dias_recordatorio),
    }


def a_dict_vigente(v: ProcesoVigente, nombres_tipos: dict[int, str] | None = None) -> dict:
    return {
        'proceso': a_dict_proceso(v.proceso, nombres_tipos), 'solicitud': a_dict_solicitud(v.solicitud) if v.solicitud else None,
        'puede_enviar': v.puede_enviar,
    }


def a_dict_prorroga(p: ProrrogaProceso) -> dict:
    return {
        'id': p.id, 'proceso_id': p.proceso_id, 'cedula': p.cedula, 'general': p.general,
        'nueva_fecha_limite': p.nueva_fecha_limite, 'motivo': p.motivo, 'concedida_por': p.concedida_por,
    }


def a_dict_cobertura(p: PasivoCobertura) -> dict:
    return {
        'cedula': p.cedula, 'nombre_completo': p.nombre_completo, 'tipo_nomina': p.tipo_nomina, 'correo': p.correo,
        'sin_correo': p.sin_correo, 'tiene_cuenta': p.tiene_cuenta,
    }


ESTADO_CONSTANCIA_VALIDA = 'VALIDA'


def a_dict_verificacion(v: VerificacionConstancia) -> dict:
    return {
        'numero': v.numero, 'emitida_en': v.emitida_en, 'proceso_nombre': v.proceso_nombre,
        'nombre_completo': v.nombre_completo, 'cedula': v.cedula, 'estado': v.estado, 'solicitud_id': v.solicitud_id,
        'certificada_por': [{'nombre': x.nombre, 'cedula': x.cedula, 'rol': x.rol} for x in v.certificada_por],
    }


def a_dict_verificacion_publica(v: VerificacionConstancia) -> dict:
    return {
        'numero': v.numero, 'emitida_en': v.emitida_en, 'proceso_nombre': v.proceso_nombre,
        'nombre_completo': v.nombre_completo, 'cedula_enmascarada': v.cedula, 'estado': ESTADO_CONSTANCIA_VALIDA,
    }
