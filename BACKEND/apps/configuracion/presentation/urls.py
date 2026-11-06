from django.urls import path

from apps.configuracion.presentation.views.configuracion_visual_views import (
    ConfiguracionVisualLogoView,
    ConfiguracionVisualVersionesView,
    ConfiguracionVisualVersionRestaurarView,
    ConfiguracionVisualVersionView,
    ConfiguracionVisualView,
)
from apps.configuracion.presentation.views.correo_acceso_config_views import (
    AplicarPoliticaCorreoAccesoView,
    PoliticaCorreoAccesoView,
    VistaPreviaCorreoAccesoView,
)
from apps.configuracion.presentation.views.parametros_views import (
    ParametroHistorialView,
    ParametroView,
    ParametrosView,
    RecordatoriosFeDeVidaView,
)
from apps.configuracion.presentation.views.reglas_catalogos_views import (
    ReglaMotivoCategoriaView,
    ReglaMotivoCrearView,
    ReglaMotivoDetailView,
    ReglaNominaUpdateView,
    ReglaParentescoUpdateView,
    ReglasCatalogosListView,
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
    # Reglas de catálogos (A5)
    path('reglas-catalogos/', ReglasCatalogosListView.as_view(), name='reglas_catalogos_list'),
    path('reglas-catalogos/parentescos/<int:id>/', ReglaParentescoUpdateView.as_view(), name='regla_parentesco_update'),
    path('reglas-catalogos/motivos/<int:id>/categoria/', ReglaMotivoCategoriaView.as_view(), name='regla_motivo_categoria'),
    path('reglas-catalogos/motivos/<int:id>/', ReglaMotivoDetailView.as_view(), name='regla_motivo_detail'),
    path('reglas-catalogos/motivos/', ReglaMotivoCrearView.as_view(), name='regla_motivo_crear'),
    path('reglas-catalogos/nominas/<int:id>/', ReglaNominaUpdateView.as_view(), name='regla_nomina_update'),
    # Correo de acceso configurable y masivo (A7)
    path('correo-acceso/politica/', PoliticaCorreoAccesoView.as_view(), name='correo_acceso_politica'),
    path('correo-acceso/vista-previa/', VistaPreviaCorreoAccesoView.as_view(), name='correo_acceso_vista_previa'),
    path('correo-acceso/aplicar/', AplicarPoliticaCorreoAccesoView.as_view(), name='correo_acceso_aplicar'),
]
