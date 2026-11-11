from django.urls import path

from apps.carnetizacion.presentation.views.integracion_views import VerificarCarnetIntegracionView

app_name = 'integraciones_carnet'

urlpatterns = [
    path('verificar/', VerificarCarnetIntegracionView.as_view(), name='verificar'),
]
