from django.conf import settings
from django.urls import path, include

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from rest_framework.permissions import IsAuthenticated

from core.presentation.views.media_views import servir_archivo_media
from apps.reportes.presentation.views.reportes_views import ReportePersonalActivoExcelView

PERMISOS_DOCUMENTACION = [IsAuthenticated]
PREFIJO_MEDIA = settings.MEDIA_URL.lstrip('/')

urlpatterns = [
    # Módulos de Dominio Onion bajo /api/v1/ (D-06, B12)
    path('api/v1/identidad/', include('apps.identidad.presentation.urls')),
    path('api/v1/organizacion/', include('apps.organizacion.presentation.urls')),
    path('api/v1/catalogos/', include('apps.catalogos.presentation.urls')),
    path('api/v1/cargos/', include('apps.cargos.presentation.urls')),
    path('api/v1/familiares/', include('apps.familiares.presentation.urls')),
    path('api/v1/personal/', include('apps.personal.presentation.urls')),
    path('api/v1/pasivos/', include('apps.pasivos.presentation.urls')),
    path('api/v1/carnetizacion/', include('apps.carnetizacion.presentation.urls')),
    path('api/v1/autogestion/', include('apps.autogestion.presentation.urls')),
    path('api/v1/fe-de-vida/', include('apps.fe_de_vida.presentation.urls')),
    path('api/v1/notificaciones/', include('apps.notificaciones.presentation.urls')),
    path('api/v1/reportes/', include('apps.reportes.presentation.urls')),
    path('api/v1/movimientos/', include('apps.movimientos.presentation.urls')),
    path('api/v1/configuracion/', include('apps.configuracion.presentation.urls')),
    path('api/v1/auditoria/', include('apps.auditoria.presentation.urls')),
    path('api/v1/puntocuenta/', include('apps.puntocuenta.presentation.urls')),
    path('reportes/excel/', ReportePersonalActivoExcelView.as_view(), name='reporte-excel-legado'),
    path(
        'api/schema/',
        SpectacularAPIView.as_view(permission_classes=PERMISOS_DOCUMENTACION),
        name='schema',
    ),
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(
            url_name='schema',
            permission_classes=PERMISOS_DOCUMENTACION,
        ),
        name='swagger-ui',
    ),
    path(
        'api/redoc/',
        SpectacularRedocView.as_view(
            url_name='schema',
            permission_classes=PERMISOS_DOCUMENTACION,
        ),
        name='redoc',
    ),
    path(
        f'{PREFIJO_MEDIA}<path:ruta>',
        servir_archivo_media,
        name='servir-archivo-media',
    ),
]
