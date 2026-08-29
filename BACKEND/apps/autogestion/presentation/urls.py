from django.urls import path

from apps.autogestion.presentation.views.autogestion_views import (
    CensoEmpleadoView,
    PreguntasCensoListView,
    ReporteCensoDependenciasView,
)

app_name = 'autogestion'

urlpatterns = [
    path('preguntas/', PreguntasCensoListView.as_view(), name='censo-preguntas-list'),
    path('censo/reporte-dependencias/', ReporteCensoDependenciasView.as_view(), name='censo-reporte-dependencias'),
    path('censo/<str:cedula>/', CensoEmpleadoView.as_view(), name='censo-empleado'),
]
