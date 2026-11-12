"""Vistas REST de credenciales externas y temporales (O45-A)."""
from datetime import datetime, time

from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasAnyPermission, HasPermission
from apps.carnetizacion.application.use_cases.gestionar_credenciales_externas import (
    anular_credencial_externa,
    crear_credencial_externa,
    devolver_credencial_externa,
    enviar_credencial_externa,
    generar_pdf_credencial_externa,
    generar_pdf_lote_credenciales,
    listar_credenciales_externas,
)
from apps.carnetizacion.infrastructure.repositories.repo_credenciales_externas_orm import (
    RepoCredencialesExternasORM,
)
from apps.carnetizacion.presentation.serializers.credenciales_externas_serializers import (
    CrearCredencialExternaSerializer,
    CrearTemporalSerializer,
    CredencialExternaSerializer,
    EnviarCredencialInputSerializer,
    LoteCredencialesInputSerializer,
)


def _fecha(valor: str | None) -> datetime | None:
    if not valor:
        return None
    resultado = parse_datetime(valor)
    if resultado is None:
        fecha = parse_date(valor)
        if fecha is None:
            return None
        resultado = datetime.combine(fecha, time.min)
    if timezone.is_naive(resultado):
        resultado = timezone.make_aware(resultado)
    return resultado


class CredencialesExternasListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.visitantes')]

    @extend_schema(
        tags=['Carnetización'],
        summary='Listar credenciales de visitantes y contratistas',
        parameters=[
            OpenApiParameter('tipo', str, required=False),
            OpenApiParameter('estado', str, required=False),
            OpenApiParameter('desde', str, required=False),
            OpenApiParameter('hasta', str, required=False),
        ],
    )
    def get(self, request):
        repo = RepoCredencialesExternasORM()
        filas = listar_credenciales_externas(
            repo,
            tipo=(request.query_params.get('tipo') or '').strip() or None,
            grupo='externo',
            estado=(request.query_params.get('estado') or '').strip() or None,
            desde=_fecha(request.query_params.get('desde')),
            hasta=_fecha(request.query_params.get('hasta')),
        )
        return ok(CredencialExternaSerializer(filas, many=True).data)

    @extend_schema(
        tags=['Carnetización'],
        summary='Registrar credencial de visitante o contratista',
        request=CrearCredencialExternaSerializer,
        responses={201: CredencialExternaSerializer},
    )
    def post(self, request):
        serializer = CrearCredencialExternaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        fila = crear_credencial_externa(
            RepoCredencialesExternasORM(),
            grupo_esperado='externo',
            creado_por=request.user,
            **datos,
        )
        return ok(CredencialExternaSerializer(fila).data, 'Credencial emitida.', status=201)


class CredencialesTemporalesListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('carnetizacion.temporal')]

    @extend_schema(tags=['Carnetización'], summary='Listar credenciales temporales de trabajadores')
    def get(self, request):
        repo = RepoCredencialesExternasORM()
        filas = listar_credenciales_externas(
            repo,
            tipo=(request.query_params.get('tipo') or '').strip() or None,
            grupo='temporal',
            estado=(request.query_params.get('estado') or '').strip() or None,
            desde=_fecha(request.query_params.get('desde')),
            hasta=_fecha(request.query_params.get('hasta')),
        )
        return ok(CredencialExternaSerializer(filas, many=True).data)

    @extend_schema(
        tags=['Carnetización'],
        summary='Emitir credencial temporal por olvido o extravío',
        request=CrearTemporalSerializer,
        responses={201: CredencialExternaSerializer},
    )
    def post(self, request):
        serializer = CrearTemporalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        fila = crear_credencial_externa(
            RepoCredencialesExternasORM(),
            grupo_esperado='temporal',
            creado_por=request.user,
            **datos,
        )
        return ok(CredencialExternaSerializer(fila).data, 'Credencial temporal emitida.', status=201)


class CredencialExternaDetailView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasAnyPermission('carnetizacion.visitantes', 'carnetizacion.temporal'),
    ]

    @extend_schema(tags=['Carnetización'], summary='Consultar una credencial externa o temporal')
    def get(self, request, credencial_id: str):
        fila = RepoCredencialesExternasORM().obtener(credencial_id)
        return ok(CredencialExternaSerializer(fila).data)


class CredencialExternaDevolverView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasAnyPermission('carnetizacion.visitantes', 'carnetizacion.temporal'),
    ]

    @extend_schema(tags=['Carnetización'], summary='Registrar devolución de una credencial')
    def post(self, request, credencial_id: str):
        fila = devolver_credencial_externa(RepoCredencialesExternasORM(), credencial_id)
        return ok(CredencialExternaSerializer(fila).data, 'Devolución registrada.')


class CredencialExternaAnularView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasAnyPermission('carnetizacion.visitantes', 'carnetizacion.temporal'),
    ]

    @extend_schema(tags=['Carnetización'], summary='Anular una credencial externa o temporal')
    def post(self, request, credencial_id: str):
        fila = anular_credencial_externa(RepoCredencialesExternasORM(), credencial_id)
        return ok(CredencialExternaSerializer(fila).data, 'Credencial anulada.')


class CredencialExternaPdfView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasAnyPermission('carnetizacion.visitantes', 'carnetizacion.temporal'),
    ]

    @extend_schema(tags=['Carnetización'], summary='Descargar credencial externa/temporal en PDF')
    def get(self, request, credencial_id: str):
        pdf = generar_pdf_credencial_externa(RepoCredencialesExternasORM(), credencial_id)
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="credencial_{credencial_id}.pdf"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class CredencialesLotePdfView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasAnyPermission('carnetizacion.lote', 'carnetizacion.visitantes', 'carnetizacion.temporal'),
    ]

    @extend_schema(
        tags=['Carnetización'],
        summary='Generar hoja A4 con varias credenciales y marcas de corte',
        request=LoteCredencialesInputSerializer,
    )
    def post(self, request):
        serializer = LoteCredencialesInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pdf = generar_pdf_lote_credenciales(
            RepoCredencialesExternasORM(), serializer.validated_data['ids']
        )
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="lote_credenciales.pdf"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class CredencialExternaEnviarView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasAnyPermission('carnetizacion.enviar', 'carnetizacion.visitantes', 'carnetizacion.temporal'),
    ]

    @extend_schema(
        tags=['Carnetización'],
        summary='Enviar la credencial por correo usando el outbox',
        request=EnviarCredencialInputSerializer,
    )
    def post(self, request, credencial_id: str):
        serializer = EnviarCredencialInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enviado = enviar_credencial_externa(
            RepoCredencialesExternasORM(),
            credencial_id,
            destinatario=serializer.validated_data.get('destinatario') or None,
        )
        mensaje = 'Correo encolado.' if enviado else 'El correo ya estaba encolado.'
        return ok({'enviado': enviado}, mensaje)


class CarnetQrImagenView(APIView):
    """PNG del QR de una credencial; no expone datos, solo el hash de verificación."""
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle, UserRateThrottle]

    @extend_schema(tags=['Carnetización'], summary='Imagen QR de una credencial')
    def get(self, request, security_hash: str):
        from apps.carnetizacion.domain.value_objects.security_hash import normalizar_codigo_qr
        from apps.carnetizacion.infrastructure.qr_institucional import contenido_qr_carnet, generar_qr_png

        if normalizar_codigo_qr(security_hash) != security_hash:
            return fail('Código de carnet inválido.', status=404)
        contenido = contenido_qr_carnet(security_hash)
        respuesta = HttpResponse(
            generar_qr_png(contenido, box_size=8, border=2, con_logo=True),
            content_type='image/png',
        )
        respuesta['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        respuesta['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
        return respuesta
