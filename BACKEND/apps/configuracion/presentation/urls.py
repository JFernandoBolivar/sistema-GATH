from django.urls import path

from apps.configuracion.presentation.views.configuracion_visual_views import (
    ConfiguracionVisualLogoView,
    ConfiguracionVisualView,
)

app_name = 'configuracion'

urlpatterns = [
    path('visual/', ConfiguracionVisualView.as_view(), name='configuracion_visual'),
    path('visual/logo/<slug:campo>/', ConfiguracionVisualLogoView.as_view(), name='configuracion_visual_logo'),
]
