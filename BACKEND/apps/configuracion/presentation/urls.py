from django.urls import path

from apps.configuracion.presentation.views.configuracion_visual_views import (
    ConfiguracionVisualLogoView,
    ConfiguracionVisualVersionesView,
    ConfiguracionVisualVersionRestaurarView,
    ConfiguracionVisualVersionView,
    ConfiguracionVisualView,
)
from apps.configuracion.presentation.views.parametros_views import (
    ParametroHistorialView,
    ParametroView,
    ParametrosView,
    RecordatoriosFeDeVidaView,
)

app_name = 'configuracion'

urlpatterns = [
    path('visual/', ConfiguracionVisualView.as_view(), name='configuracion_visual'),
    path('visual/logo/<slug:campo>/', ConfiguracionVisualLogoView.as_view(), name='configuracion_visual_logo'),
    path('visual/logo/<slug:campo>/versiones/', ConfiguracionVisualVersionesView.as_view(),
         name='configuracion_visual_versiones'),
    path('visual/logo/<slug:campo>/versiones/<uuid:version_id>/', ConfiguracionVisualVersionView.as_view(),
         name='configuracion_visual_version'),
    path('visual/logo/<slug:campo>/versiones/<uuid:version_id>/restaurar/',
         ConfiguracionVisualVersionRestaurarView.as_view(), name='configuracion_visual_version_restaurar'),
    path('parametros/', ParametrosView.as_view(), name='parametros'),
    path('parametros/recordatorios-fe-de-vida/', RecordatoriosFeDeVidaView.as_view(), name='recordatorios_fe_de_vida'),
    path('parametros/<str:clave>/historial/', ParametroHistorialView.as_view(), name='parametro_historial'),
    path('parametros/<str:clave>/', ParametroView.as_view(), name='parametro'),
]
