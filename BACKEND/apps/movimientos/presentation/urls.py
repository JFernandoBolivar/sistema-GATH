from django.urls import path

from apps.movimientos.presentation.views.movimientos_views import (
    HistorialPorCargoView,
    HistorialPorEmpleadoView,
)

app_name = 'movimientos'

urlpatterns = [
    path('empleado/<str:cedula>/', HistorialPorEmpleadoView.as_view(), name='historial-por-empleado'),
    path('cargo/<str:codigo_puesto>/', HistorialPorCargoView.as_view(), name='historial-por-cargo'),
]
