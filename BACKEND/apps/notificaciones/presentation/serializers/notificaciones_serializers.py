from rest_framework import serializers


class NotificacionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    tipo = serializers.CharField(help_text='Código del hecho, p. ej. autogestion.ventana_habilitada')
    titulo = serializers.CharField()
    mensaje = serializers.CharField()
    enlace = serializers.CharField(help_text='Ruta interna relativa del frontend ("" si no hay)')
    ref_tipo = serializers.CharField()
    ref_id = serializers.CharField()
    leida = serializers.BooleanField()
    fecha_lectura = serializers.DateTimeField(allow_null=True)
    creada_en = serializers.DateTimeField()


class ListaNotificacionesSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    limit = serializers.IntegerField()
    offset = serializers.IntegerField()
    results = NotificacionSerializer(many=True)


class ConteoNoLeidasSerializer(serializers.Serializer):
    no_leidas = serializers.IntegerField()


class MarcadaLeidaSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    leida = serializers.BooleanField()


class MarcadasLeidasSerializer(serializers.Serializer):
    marcadas = serializers.IntegerField()


def a_dict_notificacion(n) -> dict:
    return {
        'id': n.id, 'tipo': n.tipo, 'titulo': n.titulo, 'mensaje': n.mensaje, 'enlace': n.enlace,
        'ref_tipo': n.ref_tipo, 'ref_id': n.ref_id, 'leida': n.leida,
        'fecha_lectura': n.fecha_lectura, 'creada_en': n.creada_en,
    }
