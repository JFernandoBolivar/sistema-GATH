from django.urls import path

from apps.cargos.presentation.views.carga_masiva_views import ImportarCargosEspecialesView
from apps.cargos.presentation.views.cargos_views import (
    AsignarCargoEspecialView,
    AsignarCargoView,
    CambiarCargoView,
    CargosListView,
    CargosVacantesListView,
    DenominacionesEspecificasListView,
    DenominacionesListView,
    DesasignarCargoView,
    GestionarEstatusPuestoView,
    PrestamoCargoFinalizarView,
    PrestamoCargoListCreateView,
)

app_name = 'cargos'

urlpatterns = [
    path('denominaciones/', DenominacionesListView.as_view(), name='denominaciones-list'),
    path('denominaciones-especificas/', DenominacionesEspecificasListView.as_view(), name='denominaciones-especificas-list'),
    path('', CargosListView.as_view(), name='cargos-list'),
    path('vacantes/', CargosVacantesListView.as_view(), name='cargos-vacantes-list'),
    path('especiales/asignar/', AsignarCargoEspecialView.as_view(), name='cargo-especial-asignar'),
    path('carga-masiva/especiales/', ImportarCargosEspecialesView.as_view(), name='cargo-carga-masiva-especiales'),
    path('prestamos/', PrestamoCargoListCreateView.as_view(), name='cargo-prestamos-list-create'),
    path('prestamos/<int:prestamo_id>/finalizar/', PrestamoCargoFinalizarView.as_view(), name='cargo-prestamo-finalizar'),
    path('<int:cargo_id>/asignar/', AsignarCargoView.as_view(), name='cargo-asignar'),
    path('<int:cargo_id>/desasignar/', DesasignarCargoView.as_view(), name='cargo-desasignar'),
    path('<int:cargo_id>/estatus/', GestionarEstatusPuestoView.as_view(), name='cargo-gestionar-estatus'),
    path('<int:cargo_actual_id>/cambiar/', CambiarCargoView.as_view(), name='cargo-cambiar'),
]
