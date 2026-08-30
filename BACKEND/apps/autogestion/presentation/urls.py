from django.urls import path

from apps.autogestion.presentation.views.autogestion_views import (
    CensoEmpleadoView,
    CensoExcelView,
    MetricasCensoView,
    PreguntasCensoListView,
    ReporteCensoDependenciasView,
)

app_name = 'autogestion'

urlpatterns = [
    path('preguntas/', PreguntasCensoListView.as_view(), name='censo-preguntas-list'),
    path('censo/export/excel/', CensoExcelView.as_view(), name='censo-export-excel'),
    path('censo/reporte-dependencias/', ReporteCensoDependenciasView.as_view(), name='censo-reporte-dependencias'),
    path('censo/metricas/', MetricasCensoView.as_view(), name='censo-metricas'),
    path('censo/<str:cedula>/', CensoEmpleadoView.as_view(), name='censo-empleado'),
]
