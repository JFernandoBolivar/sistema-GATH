"""
Serializers de la solicitud de actualización: entrada validada y salida documentada (drf-spectacular).

La salida se arma con las funciones `a_dict_*` (convierten enums a texto) y se pasa por el
serializer correspondiente, que fija formato de fechas y documenta el contrato OpenAPI.
"""
from rest_framework import serializers

from apps.autogestion.application.dtos.actualizacion_dtos import DetalleSolicitudDTO

ACCIONES = ('MODIFICAR', 'CREAR')


# ── Entrada ──
class SolicitarActualizacionSerializer(serializers.Serializer):
    campos = serializers.ListField(
        child=serializers.CharField(max_length=80), required=False, allow_empty=False, max_length=60,
        help_text="Campos a actualizar con formato `entidad.campo` (p. ej. `employee.telefono_movil`). Las secciones solo agrupan.",
    )
    secciones = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, allow_empty=False, max_length=10,
        help_text='Alternativa sin `campos`: pide todos los campos de esas secciones.',
    )
    motivo = serializers.CharField(max_length=500, help_text='Un solo motivo: mínimo 5 palabras y 20 caracteres.')


class FiltrosListaSolicitudesSerializer(serializers.Serializer):
    """Query string de las listas de solicitudes (propias y bandeja de Bienestar)."""

    estado = serializers.CharField(required=False, allow_blank=True)
    fecha_desde = serializers.DateField(required=False, help_text='Inclusive, AAAA-MM-DD (fecha de solicitud).')
    fecha_hasta = serializers.DateField(required=False, help_text='Inclusive, AAAA-MM-DD.')
    limit = serializers.IntegerField(required=False, min_value=1)
    offset = serializers.IntegerField(required=False, min_value=0)


class HabilitarVentanaSerializer(serializers.Serializer):
    plazo_dias = serializers.IntegerField(min_value=1, max_value=90, help_text='Plazo que configura Bienestar (1 a 90 días).')
    secciones = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False,
        help_text='Subconjunto de las secciones solicitadas; por defecto, todas.',
    )


class ProrrogarVentanaSerializer(serializers.Serializer):
    nueva_fecha_fin = serializers.DateTimeField(help_text='Nueva fecha límite (posterior a la vigente y a hoy).')
    motivo = serializers.CharField(max_length=500)


class ItemCambioSerializer(serializers.Serializer):
    seccion = serializers.CharField(max_length=30)
    entidad = serializers.CharField(max_length=40, help_text='employee | datos_complementarios | datos_vivienda | formacion_academica | contacto_emergencia | familiar')
    accion = serializers.ChoiceField(choices=ACCIONES)
    campo = serializers.CharField(max_length=60, help_text="Campo a modificar; '*' al CREAR un registro.")
    valor = serializers.JSONField(allow_null=True, help_text='Valor propuesto; al CREAR, un objeto con los campos del registro.')
    entidad_id = serializers.CharField(max_length=32, required=False, allow_null=True, allow_blank=True)


class GuardarBorradorSerializer(serializers.Serializer):
    version = serializers.IntegerField(required=False, min_value=1, help_text='Versión que vio el cliente (bloqueo optimista).')
    cambios = serializers.ListField(child=ItemCambioSerializer(), allow_empty=True, max_length=60)


class SubirSoporteSerializer(serializers.Serializer):
    seccion = serializers.CharField(max_length=30)
    tipo = serializers.ChoiceField(choices=['TITULO', 'ACTA_NACIMIENTO', 'CONSTANCIA', 'FOTO', 'OTRO'])
    file = serializers.FileField(help_text='PDF, JPG o PNG (máx. 10 MB; la foto: JPG/PNG de hasta 5 MB).')


class EnviarSolicitudSerializer(serializers.Serializer):
    version = serializers.IntegerField(required=False, min_value=1)


class DecisionCampoSerializer(serializers.Serializer):
    cambio_id = serializers.UUIDField()
    aprobado = serializers.BooleanField()
    motivo = serializers.CharField(max_length=500, required=False, allow_blank=True, default='',
                                   help_text='Obligatorio al rechazar el campo.')


class DecidirCambiosSerializer(serializers.Serializer):
    version = serializers.IntegerField(min_value=1, help_text='Versión de la solicitud que vio quien decide (bloqueo optimista).')
    decisiones = serializers.ListField(child=DecisionCampoSerializer(), allow_empty=False, max_length=200)
    motivo_general = serializers.CharField(max_length=500, required=False, allow_blank=True, default='',
                                           help_text='Obligatorio si no se aprueba ningún campo (rechazo total).')


class RechazarSolicitudSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500)
    version = serializers.IntegerField(required=False, min_value=1)


class DevolverSolicitudSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500, help_text='Obligatorio: lo ve el trabajador para corregir.')
    version = serializers.IntegerField(required=False, min_value=1)


class ConfigurarSeccionSerializer(serializers.Serializer):
    requiere_soporte = serializers.BooleanField(required=False)
    activa = serializers.BooleanField(required=False)


class DatosComplementariosEscrituraSerializer(serializers.Serializer):
    correo_alternativo = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=254)
    tiene_hijos = serializers.BooleanField(required=False, allow_null=True)


# ── Salida ──
class SolicitudSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    cedula = serializers.CharField()
    estado = serializers.CharField(help_text='SOLICITADA | HABILITADA | ENVIADA | DEVUELTA | APROBADA | APROBADA_PARCIAL | RECHAZADA | EXPIRADA')
    secciones_solicitadas = serializers.ListField(child=serializers.CharField())
    secciones_habilitadas = serializers.ListField(child=serializers.CharField())
    motivo = serializers.CharField()
    ventana_inicio = serializers.DateTimeField(allow_null=True)
    ventana_fin = serializers.DateTimeField(allow_null=True)
    plazo_dias = serializers.IntegerField(allow_null=True)
    habilitada_por = serializers.CharField()
    decidida_por = serializers.CharField()
    motivo_decision = serializers.CharField()
    version = serializers.IntegerField()
    fecha_solicitud = serializers.DateTimeField(allow_null=True)
    fecha_envio = serializers.DateTimeField(allow_null=True)
    fecha_decision = serializers.DateTimeField(allow_null=True)
    campos_solicitados = serializers.ListField(child=serializers.CharField(), help_text='`entidad.campo` pedidos por el trabajador.')
    campos_habilitados = serializers.ListField(child=serializers.CharField(), help_text='Únicos campos que el trabajador puede editar.')
    motivo_devolucion = serializers.CharField(help_text='Motivo de la última devolución de Bienestar.')
    devuelta_por = serializers.CharField()
    fecha_devolucion = serializers.DateTimeField(allow_null=True)


class CambioPropuestoSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    seccion = serializers.CharField()
    accion = serializers.CharField()
    entidad_destino = serializers.CharField()
    entidad_id = serializers.CharField(allow_null=True)
    campo = serializers.CharField()
    valor_anterior = serializers.JSONField(allow_null=True)
    valor_propuesto = serializers.JSONField(allow_null=True)
    valor_actual = serializers.JSONField(allow_null=True, help_text='Valor vigente hoy en la ficha (solo en solicitudes ENVIADAS).')
    conflicto = serializers.BooleanField(help_text='La ficha cambió tras la propuesta: no puede aprobarse tal cual.')
    decision = serializers.CharField(help_text='PENDIENTE | APROBADO | RECHAZADO')
    motivo_decision = serializers.CharField()
    decidido_por = serializers.CharField()
    fecha_decision = serializers.DateTimeField(allow_null=True)


class SoporteSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    seccion = serializers.CharField()
    tipo = serializers.CharField()
    mime_real = serializers.CharField()
    tamano_bytes = serializers.IntegerField()
    nombre_original = serializers.CharField()
    fecha = serializers.DateTimeField(allow_null=True)
    url_archivo = serializers.CharField(help_text='Endpoint autenticado que sirve el archivo (streaming).')


class ProrrogaSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    fecha_fin_anterior = serializers.DateTimeField()
    fecha_fin_nueva = serializers.DateTimeField()
    motivo = serializers.CharField()
    prorrogada_por = serializers.CharField()
    fecha = serializers.DateTimeField(allow_null=True)


class DetalleSolicitudSerializer(SolicitudSerializer):
    cambios = CambioPropuestoSerializer(many=True)
    soportes = SoporteSerializer(many=True)
    prorrogas = ProrrogaSerializer(many=True)


class ListaSolicitudesSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    limit = serializers.IntegerField()
    offset = serializers.IntegerField()
    results = SolicitudSerializer(many=True)


class SeccionAutogestionableSerializer(serializers.Serializer):
    codigo = serializers.CharField()
    nombre = serializers.CharField()
    requiere_soporte = serializers.BooleanField()
    activa = serializers.BooleanField()


class DatosComplementariosSerializer(serializers.Serializer):
    cedula = serializers.CharField()
    correo_alternativo = serializers.CharField(allow_null=True)
    tiene_hijos = serializers.BooleanField(allow_null=True)
    actualizado_en = serializers.DateTimeField(allow_null=True)
    actualizado_por = serializers.CharField()


# ── Conversión entidad -> dict ──
def a_dict_solicitud(s) -> dict:
    return {
        'id': s.id, 'cedula': s.cedula, 'estado': s.estado.value,
        'secciones_solicitadas': list(s.secciones_solicitadas), 'secciones_habilitadas': list(s.secciones_habilitadas),
        'motivo': s.motivo, 'ventana_inicio': s.ventana_inicio, 'ventana_fin': s.ventana_fin,
        'plazo_dias': s.plazo_dias, 'habilitada_por': s.habilitada_por, 'decidida_por': s.decidida_por,
        'motivo_decision': s.motivo_decision, 'version': s.version, 'fecha_solicitud': s.fecha_solicitud,
        'fecha_envio': s.fecha_envio, 'fecha_decision': s.fecha_decision,
        'campos_solicitados': list(s.campos_solicitados), 'campos_habilitados': list(s.campos_habilitados),
        'motivo_devolucion': s.motivo_devolucion, 'devuelta_por': s.devuelta_por, 'fecha_devolucion': s.fecha_devolucion,
    }


def a_dict_cambio(item) -> dict:
    c = item.cambio
    return {
        'id': c.id, 'seccion': c.seccion, 'accion': c.accion, 'entidad_destino': c.entidad_destino,
        'entidad_id': c.entidad_id, 'campo': c.campo, 'valor_anterior': c.valor_anterior,
        'valor_propuesto': c.valor_propuesto, 'valor_actual': item.valor_actual, 'conflicto': item.conflicto,
        'decision': c.decision.value, 'motivo_decision': c.motivo_decision, 'decidido_por': c.decidido_por,
        'fecha_decision': c.fecha_decision,
    }


def a_dict_soporte(s) -> dict:
    return {
        'id': s.id, 'seccion': s.seccion, 'tipo': s.tipo, 'mime_real': s.mime_real,
        'tamano_bytes': s.tamano_bytes, 'nombre_original': s.nombre_original, 'fecha': s.fecha,
        'url_archivo': f'/api/v1/autogestion/soportes/{s.id}/archivo/',
    }


def serializar_detalle(dto: DetalleSolicitudDTO) -> dict:
    datos = a_dict_solicitud(dto.solicitud)
    datos['cambios'] = [a_dict_cambio(i) for i in dto.cambios]
    datos['soportes'] = [a_dict_soporte(s) for s in dto.soportes]
    datos['prorrogas'] = [
        {'id': p.id, 'fecha_fin_anterior': p.fecha_fin_anterior, 'fecha_fin_nueva': p.fecha_fin_nueva,
         'motivo': p.motivo, 'prorrogada_por': p.prorrogada_por, 'fecha': p.fecha}
        for p in dto.prorrogas
    ]
    return DetalleSolicitudSerializer(datos).data


def serializar_solicitud(s) -> dict:
    return SolicitudSerializer(a_dict_solicitud(s)).data
