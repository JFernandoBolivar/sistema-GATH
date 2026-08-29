from django.urls import path

from apps.organizacion.presentation.views.organizacion_views import (
    CoordinacionesListView,
    DependenciasListView,
    DireccionesGeneralesListView,
    DireccionesLineaListView,
    OrganismosAdscritosListView,
)

app_name = 'organizacion'

urlpatterns = [
    path('dependencias/', DependenciasListView.as_view(), name='dependencias-list'),
    path('direcciones-generales/', DireccionesGeneralesListView.as_view(), name='direcciones-generales-list'),
    path('direcciones-linea/', DireccionesLineaListView.as_view(), name='direcciones-linea-list'),
    path('coordinaciones/', CoordinacionesListView.as_view(), name='coordinaciones-list'),
    path('organismos-adscritos/', OrganismosAdscritosListView.as_view(), name='organismos-adscritos-list'),
]
