from django.urls import path

from apps.cargos.presentation.views.carga_masiva_views import ImportarCargosEspecialesView
from apps.cargos.presentation.views.cargos_views import (
    ActualizarCargoView,
    AsignarCargoEspecialView,
    AsignarCargoView,
    CambiarCargoView,
    CargosListView,
    CargosVacantesListView,
    CrearCargoView,
    DenominacionesEspecificasListView,
    DenominacionesListView,
    DenominacionCreateView,
    DenominacionDeleteView,
    DenominacionEspecificaCreateView,
    DenominacionEspecificaDeleteView,
    DenominacionEspecificaUpdateView,
    DenominacionUpdateView,
    DesasignarCargoView,
    GestionarEstatusPuestoView,
    PrestamoCargoFinalizarView,
    PrestamoCargoListCreateView,
)

app_name = 'cargos'

urlpatterns = [
    path('denominaciones/', DenominacionesListView.as_view(), name='denominaciones-list'),
    path('denominaciones/crear/', DenominacionCreateView.as_view(), name='denominacion-crear'),
    path('denominaciones/<int:denominacion_id>/', DenominacionUpdateView.as_view(), name='denominacion-actualizar'),
    path('denominaciones/<int:denominacion_id>/eliminar/', DenominacionDeleteView.as_view(), name='denominacion-eliminar'),
    path('denominaciones-especificas/', DenominacionesEspecificasListView.as_view(), name='denominaciones-especificas-list'),
    path('denominaciones-especificas/crear/', DenominacionEspecificaCreateView.as_view(), name='denominacion-especifica-crear'),
    path('denominaciones-especificas/<int:denominacion_id>/', DenominacionEspecificaUpdateView.as_view(), name='denominacion-especifica-actualizar'),
    path('denominaciones-especificas/<int:denominacion_id>/eliminar/', DenominacionEspecificaDeleteView.as_view(), name='denominacion-especifica-eliminar'),
    path('', CargosListView.as_view(), name='cargos-list'),
    path('vacantes/', CargosVacantesListView.as_view(), name='cargos-vacantes-list'),
    path('crear/', CrearCargoView.as_view(), name='cargo-crear'),
    path('especiales/asignar/', AsignarCargoEspecialView.as_view(), name='cargo-especial-asignar'),
    path('carga-masiva/especiales/', ImportarCargosEspecialesView.as_view(), name='cargo-carga-masiva-especiales'),
    path('prestamos/', PrestamoCargoListCreateView.as_view(), name='cargo-prestamos-list-create'),
    path('prestamos/<int:prestamo_id>/finalizar/', PrestamoCargoFinalizarView.as_view(), name='cargo-prestamo-finalizar'),
    path('<int:cargo_id>/', ActualizarCargoView.as_view(), name='cargo-actualizar'),
    path('<int:cargo_id>/actualizar/', ActualizarCargoView.as_view(), name='cargo-actualizar-alt'),
    path('<int:cargo_id>/asignar/', AsignarCargoView.as_view(), name='cargo-asignar'),
    path('<int:cargo_id>/desasignar/', DesasignarCargoView.as_view(), name='cargo-desasignar'),
    path('<int:cargo_id>/estatus/', GestionarEstatusPuestoView.as_view(), name='cargo-gestionar-estatus'),
    path('<int:cargo_actual_id>/cambiar/', CambiarCargoView.as_view(), name='cargo-cambiar'),
]
