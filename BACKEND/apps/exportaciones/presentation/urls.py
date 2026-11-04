from django.urls import path

from apps.exportaciones.presentation.views.exportaciones_views import (
    DescargarExportacionView,
    EstadoExportacionView,
)

app_name = 'exportaciones'

urlpatterns = [
    path('<uuid:trabajo_id>/', EstadoExportacionView.as_view(), name='estado'),
    path('<uuid:trabajo_id>/descargar/', DescargarExportacionView.as_view(), name='descargar'),
]
