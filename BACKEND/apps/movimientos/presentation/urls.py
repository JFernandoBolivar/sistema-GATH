from django.urls import path

from apps.movimientos.presentation.views.movimientos_views import (
    HistorialMovimientosPdfView,
    HistorialMovimientosView,
    HistorialPorCargoView,
    HistorialPorEmpleadoView,
    TiposMovimientoDisponiblesView,
)

app_name = 'movimientos'

urlpatterns = [
    path('', HistorialMovimientosView.as_view(), name='historial-general'),
    path('pdf/', HistorialMovimientosPdfView.as_view(), name='historial-pdf'),
    path('tipos/', TiposMovimientoDisponiblesView.as_view(), name='tipos-movimiento-disponibles'),
    path('empleado/<str:cedula>/', HistorialPorEmpleadoView.as_view(), name='historial-por-empleado'),
    path('cargo/<str:codigo_puesto>/', HistorialPorCargoView.as_view(), name='historial-por-cargo'),
]

