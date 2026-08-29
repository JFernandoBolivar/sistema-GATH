from django.urls import path

from apps.reportes.presentation.views.reportes_views import (
    ReportePasivosExcelView,
    ReportePasivosPdfView,
    ReportePasivosView,
    ReportePersonalActivoExcelView,
    ReportePersonalActivoPdfView,
    ReportePersonalActivoView,
    ReporteVacantesExcelView,
    ReporteVacantesPdfView,
    ReporteVacantesView,
)

app_name = 'reportes'

urlpatterns = [
    path('personal-activo/', ReportePersonalActivoView.as_view(), name='reporte-personal-activo'),
    path('personal-activo/pdf/', ReportePersonalActivoPdfView.as_view(), name='reporte-personal-activo-pdf'),
    path('personal-activo/excel/', ReportePersonalActivoExcelView.as_view(), name='reporte-personal-activo-excel'),
    path('pasivos/', ReportePasivosView.as_view(), name='reporte-pasivos'),
    path('pasivos/pdf/', ReportePasivosPdfView.as_view(), name='reporte-pasivos-pdf'),
    path('pasivos/excel/', ReportePasivosExcelView.as_view(), name='reporte-pasivos-excel'),
    path('cargos-vacantes/', ReporteVacantesView.as_view(), name='reporte-vacantes'),
    path('cargos-vacantes/pdf/', ReporteVacantesPdfView.as_view(), name='reporte-vacantes-pdf'),
    path('cargos-vacantes/excel/', ReporteVacantesExcelView.as_view(), name='reporte-vacantes-excel'),
]
