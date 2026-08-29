from django.urls import path

from apps.pasivos.presentation.views.pasivos_views import (
    PasivoDetailView,
    PasivosListView,
    ProcesarEgresoView,
)

app_name = 'pasivos'

urlpatterns = [
    path('', PasivosListView.as_view(), name='pasivos-list'),
    path('<str:cedula>/', PasivoDetailView.as_view(), name='pasivo-detail'),
    path('<str:cedula>/procesar-egreso/', ProcesarEgresoView.as_view(), name='pasivo-procesar-egreso'),
]
