from django.urls import path

from apps.autogestion.presentation.views.autogestion_views import (
    CensoConsultarView,
    CensoEmpleadoView,
    CensoExcelView,
    MetricasCensoView,
    PreguntasCensoListView,
    ReporteCensoDependenciasView,
)

app_name = 'autogestion'

urlpatterns = [
    # Preguntas activas
    path('preguntas/', PreguntasCensoListView.as_view(), name='censo-preguntas-list'),

    # Consultar censos (todos o por cédula)
    path('censo/consultar/', CensoConsultarView.as_view(), name='censo-consultar-todos'),
    path('censo/consultar/<str:cedula>/', CensoConsultarView.as_view(), name='censo-consultar-empleado'),
    path('censo-vivienda/consultar/', CensoConsultarView.as_view(), name='censo-vivienda-consultar-todos'),
    path('censo-vivienda/consultar/<str:cedula>/', CensoConsultarView.as_view(), name='censo-vivienda-consultar-empleado'),

    # Reporte dependencias para gráficos
    path('censo/reporte-dependencias/', ReporteCensoDependenciasView.as_view(), name='censo-reporte-dependencias'),
    path('censo-vivienda/reporte-dependencias/', ReporteCensoDependenciasView.as_view(), name='censo-vivienda-reporte-dependencias'),

    # Métricas agregadas
    path('censo/metricas/', MetricasCensoView.as_view(), name='censo-metricas'),

    # Exportación Excel
    path('censo/export/excel/', CensoExcelView.as_view(), name='censo-export-excel'),
    path('censo-vivienda/exportar-excel/', CensoExcelView.as_view(), name='censo-vivienda-exportar-excel'),

    # Registro y consulta individual por cédula
    path('censo/<str:cedula>/', CensoEmpleadoView.as_view(), name='censo-empleado'),
    path('censo-vivienda/<str:cedula>/', CensoEmpleadoView.as_view(), name='censo-vivienda-empleado'),
]
