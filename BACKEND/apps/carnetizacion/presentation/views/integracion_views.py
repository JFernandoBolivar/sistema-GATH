"""Endpoint de integración sistema a sistema: verificación del QR del carnet para SILOG."""
import uuid

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.carnetizacion.application.use_cases.verificar_carnet_integracion import (
    verificar_carnet_integracion_uc,
)
from apps.carnetizacion.domain.entities.verificacion_integracion import normalizar_hash_carnet
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
    RepoCarnetizacionORM,
)
from apps.carnetizacion.presentation.integracion_auth import (
    ApiKeyIntegracionAuthentication,
    IntegracionCarnetThrottle,
)
from core.infrastructure.models.auditoria import AuditoriaLog
from core.presentation.audit import origen_de_peticion, registrar_auditoria

MODULO_AUDITORIA = 'carnetizacion'


class VerificacionCarnetSerializer(serializers.Serializer):
    valido = serializers.BooleanField()
    estado = serializers.CharField(help_text='VIGENTE, ANULADO, VENCIDO o NO_REGISTRADO.')
    cedula = serializers.CharField(allow_null=True, help_text='Solo dígitos, sin prefijo. En externos, null si el documento no es una cédula (p. ej. pasaporte).')
    nacionalidad = serializers.CharField(required=False, allow_null=True, help_text="'V', 'E' o null si se desconoce.")
    documento = serializers.CharField(required=False, allow_null=True, help_text='Solo credenciales externas: documento tal como se registró (cédula con prefijo, pasaporte...).')
    nombre = serializers.CharField(required=False)
    tipo_credencial = serializers.CharField(required=False, allow_null=True)
    estado_laboral = serializers.CharField(required=False, allow_null=True)
    fecha_emision = serializers.DateField(required=False, allow_null=True)
    fecha_vencimiento = serializers.DateField(required=False, allow_null=True)
    mensaje = serializers.CharField(required=False, help_text='Solo cuando `valido` es false.')
    version = serializers.IntegerField()


def _cuerpo(v) -> dict:
    if not v.valido:
        cuerpo = {'valido': False, 'estado': v.estado, 'cedula': None, 'mensaje': v.mensaje, 'version': v.version}
        if v.fecha_vencimiento:
            cuerpo['fecha_vencimiento'] = v.fecha_vencimiento  # no es un dato personal
        return cuerpo
    return {
        'valido': True,
        'estado': v.estado,
        'cedula': v.cedula,
        'nacionalidad': v.nacionalidad,
        'documento': v.documento,
        'nombre': v.nombre,
        'tipo_credencial': v.tipo_credencial,
        'estado_laboral': v.estado_laboral,
        'fecha_emision': v.fecha_emision,
        'fecha_vencimiento': v.fecha_vencimiento,
        'version': v.version,
    }


class VerificarCarnetIntegracionView(APIView):
    authentication_classes = [ApiKeyIntegracionAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [IntegracionCarnetThrottle]

    @extend_schema(
        tags=['Integraciones'],
        summary='Verificar el QR de un carnet (sistemas integrados, p. ej. SILOG)',
        description=(
            'Autenticado con la cabecera `X-API-Key` (clave por sistema, configurada en '
            '`INTEGRACION_CARNET_API_KEYS`). Responde 200 con `valido` y `estado` para que el '
            'sistema distinga "carnet no válido" de un error de red; 401 si la clave falta o es '
            'errónea, 503 si no hay claves configuradas y 429 al exceder el límite por sistema. '
            'Un código con formato inválido devuelve `NO_REGISTRADO`. No incluye datos de salud ni foto. '
            'Cada consulta queda auditada (sistema, resultado, hash truncado, IP).'
        ),
        parameters=[
            OpenApiParameter('hash', OpenApiTypes.STR, OpenApiParameter.QUERY, required=True,
                             description='Código del QR, último segmento de la URL `/carnet/<codigo>`: 22 caracteres base64url (carnets nuevos, distingue mayúsculas) o 64 hexadecimales (carnets anteriores).'),
            OpenApiParameter('X-API-Key', OpenApiTypes.STR, OpenApiParameter.HEADER, required=True,
                             description='Clave de API del sistema integrado.'),
        ],
        responses={200: VerificacionCarnetSerializer},
    )
    def get(self, request):
        v = verificar_carnet_integracion_uc(RepoCarnetizacionORM(), request.query_params.get('hash'))
        sistema = request.auth
        # Solo los primeros 8 caracteres: sirve para correlacionar y no basta para reconstruir el QR.
        # Un hash mal formado es dato del visitante sin validar: no se guarda.
        normalizado = normalizar_hash_carnet(request.query_params.get('hash'))
        truncado = normalizado[:8] if normalizado else 'FORMATO_INVALIDO'
        registrar_auditoria(
            trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
            actor_id=None,
            actor_rol=f'sistema:{sistema}'[:50],
            accion='CARNET_VERIFICADO_INTEGRACION',
            modulo=MODULO_AUDITORIA,
            recurso_tipo='CarnetQr',
            recurso_id=truncado,
            estado_nuevo={'sistema': sistema, 'estado': v.estado, 'valido': v.valido},
            resultado=AuditoriaLog.Resultado.SUCCESS if v.valido else AuditoriaLog.Resultado.FAILED,
            **origen_de_peticion(request),
        )
        respuesta = Response(_cuerpo(v), status=200)
        respuesta['Cache-Control'] = 'no-store'
        return respuesta
