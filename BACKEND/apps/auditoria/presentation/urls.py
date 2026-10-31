from django.urls import path

from apps.auditoria.presentation.views.auditoria_views import (
    AuditoriaDetalleView,
    AuditoriaExcelView,
    AuditoriaListView,
    AuditoriaOpcionesView,
    AuditoriaPdfView,
    IncidentesSeguridadView,
)

app_name = 'auditoria'

urlpatterns = [
    path('', AuditoriaListView.as_view(), name='listado'),
    path('opciones/', AuditoriaOpcionesView.as_view(), name='opciones'),
    path('incidentes/', IncidentesSeguridadView.as_view(), name='incidentes'),
    path('pdf/', AuditoriaPdfView.as_view(), name='pdf'),
    path('excel/', AuditoriaExcelView.as_view(), name='excel'),
    path('<uuid:id>/', AuditoriaDetalleView.as_view(), name='detalle'),
]
