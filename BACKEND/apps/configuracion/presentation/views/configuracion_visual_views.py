"""
Vistas delgadas de Configuración Visual (Reglas B4, B7) — HU 0009.

GET: cualquier usuario autenticado (lo consumen otros módulos/PDFs para
pintar el cintillo). PUT y subida de logos: permiso `configuracion.editar`.
"""
import logging

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.domain.exceptions import AlmacenamientoNoDisponible
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission
from core.presentation.schema import MensajeRespuestaSerializer
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

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

logger = logging.getLogger('gath.configuracion')

# Clave en SeaweedFS -> nombre de campo del modelo (mismo prefijo "configuracion/" para
# todos, un logo distinto por campo).
_CAMPO_POR_SLUG = {
    'logo-principal': 'logo_principal_clave',
    'logo-secundario': 'logo_secundario_clave',
    'cintillo-pie': 'cintillo_pie_clave',
}


def _url_firmada_o_none(clave: str | None) -> str | None:
    """Genera la URL prefirmada de una clave; `None` si no hay clave o si el
    almacenamiento no está disponible (leniente: un fallo de SeaweedFS no debe
    tumbar la lectura de la configuración, solo esa imagen puntual)."""
    if not clave:
        return None
    try:
        return SeaweedFSStorage().url_firmada(clave, expira_segundos=3600)
    except AlmacenamientoNoDisponible:
        logger.warning("No fue posible generar la URL firmada para %s (almacenamiento no disponible).", clave)
        return None


def _dto_con_urls(dto) -> dict:
    return {
        **dto.__dict__,
        'logo_principal_url': _url_firmada_o_none(dto.logo_principal_clave),
        'logo_secundario_url': _url_firmada_o_none(dto.logo_secundario_clave),
        'cintillo_pie_url': _url_firmada_o_none(dto.cintillo_pie_clave),
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
    """POST /api/v1/configuracion/visual/logo/<slug:campo>/ — multipart, campo "file"."""
    permission_classes = [IsAuthenticated, HasPermission('configuracion.editar')]

    @extend_schema(tags=['Configuración'], summary='Subir una imagen del cintillo (logo principal/secundario o pie)',
                   responses={200: ConfiguracionVisualSerializer, 400: MensajeRespuestaSerializer})
    def post(self, request, campo: str):
        nombre_campo = _CAMPO_POR_SLUG.get(campo)
        if nombre_campo is None or nombre_campo not in CAMPOS_LOGO:
            return fail(f"Imagen inválida: {campo}. Use uno de {list(_CAMPO_POR_SLUG)}.", status=400)

        archivo = request.FILES.get('file')
        if not archivo:
            return fail('No se proporcionó ningún archivo.', status=400)

        clave = f"configuracion/{campo}_{archivo.name}"
        SeaweedFSStorage().subir(clave, archivo.read(), archivo.content_type)

        dto = guardar_logo_configuracion(
            RepoConfiguracionVisualORM(), nombre_campo, clave, usuario_id=request.user.pk,
        )
        return ok(ConfiguracionVisualSerializer(_dto_con_urls(dto)).data, 'Imagen actualizada correctamente.')
