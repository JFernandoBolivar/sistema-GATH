"""
Vistas delgadas de Configuración Visual (Reglas B4, B7) — HU 0009.

GET: cualquier usuario autenticado (lo consumen otros módulos/PDFs para
pintar el cintillo). PUT y subida de logos: permiso `configuracion.editar`.
"""
import logging
import uuid

from django.urls import reverse
from drf_spectacular.types import OpenApiTypes
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.infrastructure.storage.validacion_archivo import (
    MAX_BYTES_IMAGEN,
    TIPOS_IMAGEN,
    clave_segura,
    validar_archivo,
)
from core.presentation.archivos import respuesta_archivo
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission
from core.presentation.schema import MensajeRespuestaSerializer
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

from apps.configuracion.application.use_cases.versiones_imagen_cintillo import (
    listar_versiones_imagen,
    obtener_version_imagen,
    registrar_version_imagen,
    restaurar_version_imagen,
)
from apps.configuracion.domain.entities.version_imagen_cintillo import (
    ACCION_IMAGEN_RESTAURADA,
    ACCION_IMAGEN_SUBIDA,
    RECURSO_IMAGEN_CINTILLO,
)
from apps.configuracion.domain.parametros import MODULO_AUDITORIA
from apps.configuracion.infrastructure.repositories.repo_versiones_imagen_cintillo_orm import (
    RepoVersionesImagenCintilloORM,
)
from apps.configuracion.infrastructure.serializers.version_imagen_cintillo_serializers import (
    VersionImagenCintilloSerializer,
)
from apps.configuracion.application.use_cases.actualizar_configuracion_visual import actualizar_configuracion_visual
from apps.configuracion.application.use_cases.guardar_logo_configuracion import (
    CAMPOS_LOGO,
    guardar_logo_configuracion,
)
from apps.configuracion.application.use_cases.obtener_configuracion_visual import obtener_configuracion_visual
from apps.configuracion.infrastructure.repositories.repo_configuracion_visual_orm import RepoConfiguracionVisualORM
from apps.configuracion.infrastructure.serializers.configuracion_visual_escritura_serializers import (
    ConfiguracionVisualActualizarSerializer,
)
from apps.configuracion.infrastructure.serializers.configuracion_visual_lectura_serializers import (
    ConfiguracionVisualSerializer,
)

logger = logging.getLogger(__name__)

# Clave en SeaweedFS -> nombre de campo del modelo (mismo prefijo "configuracion/" para
# todos, un logo distinto por campo).
_CAMPO_POR_SLUG = {
    'logo-principal': 'logo_principal_clave',
    'logo-secundario': 'logo_secundario_clave',
    'cintillo-pie': 'cintillo_pie_clave',
}


def _url_logo(slug: str, clave: str | None) -> str | None:
    """Ruta de la API que sirve la imagen (autenticada, por Django); `None` si
    no hay imagen cargada. Nunca se entrega al navegador una URL de SeaweedFS
    (su host pertenece a la red interna de Docker)."""
    if not clave:
        return None
    return reverse('configuracion:configuracion_visual_logo', kwargs={'campo': slug})


def _dto_con_urls(dto) -> dict:
    return {
        **dto.__dict__,
        'logo_principal_url': _url_logo('logo-principal', dto.logo_principal_clave),
        'logo_secundario_url': _url_logo('logo-secundario', dto.logo_secundario_clave),
        'cintillo_pie_url': _url_logo('cintillo-pie', dto.cintillo_pie_clave),
    }


class ConfiguracionVisualView(APIView):
    """GET/PUT /api/v1/configuracion/visual/"""

    def get_permissions(self):
        if self.request.method == 'PUT':
            return [IsAuthenticated(), HasPermission('configuracion.editar')()]
        return [IsAuthenticated()]

    @extend_schema(tags=['Configuración'], summary='Obtener la configuración visual activa',
                   responses={200: ConfiguracionVisualSerializer})
    def get(self, request):
        dto = obtener_configuracion_visual(RepoConfiguracionVisualORM())
        return ok(ConfiguracionVisualSerializer(_dto_con_urls(dto)).data)

    @extend_schema(tags=['Configuración'], summary='Actualizar la configuración visual',
                   request=ConfiguracionVisualActualizarSerializer,
                   responses={200: ConfiguracionVisualSerializer, 400: MensajeRespuestaSerializer})
    def put(self, request):
        serializer = ConfiguracionVisualActualizarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dto = actualizar_configuracion_visual(
            RepoConfiguracionVisualORM(), serializer.validated_data, usuario_id=request.user.pk,
        )
        return ok(ConfiguracionVisualSerializer(_dto_con_urls(dto)).data, 'Configuración visual actualizada correctamente.')


class ConfiguracionVisualLogoView(APIView):
    """
    GET  /api/v1/configuracion/visual/logo/<slug:campo>/ — sirve la imagen (autenticado).
    POST /api/v1/configuracion/visual/logo/<slug:campo>/ — multipart, campo "file".
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasPermission('configuracion.editar')()]
        return [IsAuthenticated()]

    @extend_schema(tags=['Configuración'], summary='Obtener una imagen del cintillo (binario)',
                   responses={200: OpenApiTypes.BINARY, 404: MensajeRespuestaSerializer})
    def get(self, request, campo: str):
        nombre_campo = _CAMPO_POR_SLUG.get(campo)
        if nombre_campo is None:
            return fail(f"Imagen inválida: {campo}.", status=400)
        dto = obtener_configuracion_visual(RepoConfiguracionVisualORM())
        clave = getattr(dto, nombre_campo)
        if not clave:
            return fail("La imagen no está cargada.", status=404)
        return respuesta_archivo(SeaweedFSStorage(), clave, cache='private, no-cache')

    @extend_schema(tags=['Configuración'], summary='Subir una imagen del cintillo (logo principal/secundario o pie)',
                   responses={200: ConfiguracionVisualSerializer, 400: MensajeRespuestaSerializer})
    def post(self, request, campo: str):
        nombre_campo = _CAMPO_POR_SLUG.get(campo)
        if nombre_campo is None or nombre_campo not in CAMPOS_LOGO:
            return fail(f"Imagen inválida: {campo}. Use uno de {list(_CAMPO_POR_SLUG)}.", status=400)

        archivo = request.FILES.get('file')
        if not archivo:
            return fail('No se proporcionó ningún archivo.', status=400)

        contenido, tipo, ext = validar_archivo(archivo, TIPOS_IMAGEN, MAX_BYTES_IMAGEN)
        clave = clave_segura(f"configuracion/{campo}", ext)
        SeaweedFSStorage().subir(clave, contenido, tipo.mime)

        # No se borra la imagen anterior: queda en el histórico (últimas 5 por imagen).
        dto, version, descartadas = registrar_version_imagen(
            RepoConfiguracionVisualORM(), RepoVersionesImagenCintilloORM(),
            nombre_campo, clave, tipo.mime, len(contenido),
            usuario_id=request.user.pk, usuario_cedula=_cedula(request),
        )
        _borrar_archivos(descartadas)
        registrar_auditoria(
            trace_id=_trace(request), accion=ACCION_IMAGEN_SUBIDA, modulo=MODULO_AUDITORIA,
            recurso_tipo=RECURSO_IMAGEN_CINTILLO, recurso_id=nombre_campo,
            estado_nuevo={'version_id': version.id, 'clave': clave, 'mime': tipo.mime, 'tamano': len(contenido)},
            **_actor(request), **origen_de_peticion(request),
        )
        return ok(ConfiguracionVisualSerializer(_dto_con_urls(dto)).data, 'Imagen actualizada correctamente.')


def _trace(request) -> str:
    return getattr(request, 'trace_id', None) or uuid.uuid4().hex


def _cedula(request) -> str:
    return str(getattr(request.user, 'cedula_id', '') or '')


def _actor(request) -> dict:
    user = request.user
    return {
        'actor_id': getattr(user, 'pk', None),
        'actor_cedula': _cedula(request),
        'actor_rol': str(getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''),
    }


def _borrar_archivos(claves: list[str]) -> None:
    for clave in claves:
        try:
            SeaweedFSStorage().eliminar(clave)
        except Exception:  # noqa: BLE001 - un archivo huérfano no debe tumbar la subida
            logger.warning('No se pudo borrar del almacenamiento la versión descartada %s.', clave)


def _url_version(slug: str, version_id: str) -> str:
    return reverse('configuracion:configuracion_visual_version', kwargs={'campo': slug, 'version_id': version_id})


def _version_con_url(slug: str, version) -> dict:
    return {**version.__dict__, 'url': _url_version(slug, version.id)}


class ConfiguracionVisualVersionesView(APIView):
    """GET /api/v1/configuracion/visual/logo/<slug:campo>/versiones/ - histórico (más reciente primero)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Configuración'], summary='Versiones de una imagen del cintillo',
                   responses={200: VersionImagenCintilloSerializer(many=True), 400: MensajeRespuestaSerializer})
    def get(self, request, campo: str):
        nombre_campo = _CAMPO_POR_SLUG.get(campo)
        if nombre_campo is None:
            return fail(f"Imagen inválida: {campo}.", status=400)
        versiones = listar_versiones_imagen(RepoVersionesImagenCintilloORM(), nombre_campo)
        return ok(VersionImagenCintilloSerializer([_version_con_url(campo, v) for v in versiones], many=True).data)


class ConfiguracionVisualVersionView(APIView):
    """GET /api/v1/configuracion/visual/logo/<slug:campo>/versiones/<uuid:version_id>/ - miniatura (binario, autenticado)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Configuración'], summary='Obtener una versión de imagen del cintillo (binario)',
                   responses={200: OpenApiTypes.BINARY, 404: MensajeRespuestaSerializer})
    def get(self, request, campo: str, version_id):
        nombre_campo = _CAMPO_POR_SLUG.get(campo)
        if nombre_campo is None:
            return fail(f"Imagen inválida: {campo}.", status=400)
        version = obtener_version_imagen(RepoVersionesImagenCintilloORM(), nombre_campo, str(version_id))
        return respuesta_archivo(SeaweedFSStorage(), version.clave, cache='private, max-age=300', mime=version.mime)


class ConfiguracionVisualVersionRestaurarView(APIView):
    """POST /api/v1/configuracion/visual/logo/<slug:campo>/versiones/<uuid:version_id>/restaurar/"""
    permission_classes = [IsAuthenticated, HasPermission('configuracion.editar')]

    @extend_schema(tags=['Configuración'], summary='Restaurar una versión anterior de una imagen del cintillo',
                   request=None, responses={200: ConfiguracionVisualSerializer, 400: MensajeRespuestaSerializer})
    def post(self, request, campo: str, version_id):
        nombre_campo = _CAMPO_POR_SLUG.get(campo)
        if nombre_campo is None:
            return fail(f"Imagen inválida: {campo}.", status=400)
        dto, version, previa = restaurar_version_imagen(
            RepoConfiguracionVisualORM(), RepoVersionesImagenCintilloORM(),
            nombre_campo, str(version_id), usuario_id=request.user.pk,
        )
        registrar_auditoria(
            trace_id=_trace(request), accion=ACCION_IMAGEN_RESTAURADA, modulo=MODULO_AUDITORIA,
            recurso_tipo=RECURSO_IMAGEN_CINTILLO, recurso_id=nombre_campo,
            estado_previo={'version_id': previa.id if previa else None, 'clave': previa.clave if previa else None},
            estado_nuevo={'version_id': version.id, 'clave': version.clave},
            **_actor(request), **origen_de_peticion(request),
        )
        return ok(ConfiguracionVisualSerializer(_dto_con_urls(dto)).data, 'Imagen restaurada correctamente.')
