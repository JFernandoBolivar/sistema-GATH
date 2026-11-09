from django.urls import path

from apps.organizacion.presentation.views.organizacion_views import (
    CoordinacionesListView,
    CoordinacionCreateView,
    CoordinacionDeleteView,
    CoordinacionUpdateView,
    DependenciasListView,
    DependenciaCreateView,
    DependenciaDeleteView,
    DependenciaUpdateView,
    DireccionesGeneralesListView,
    DireccionGeneralCreateView,
    DireccionGeneralDeleteView,
    DireccionGeneralUpdateView,
    DireccionesLineaListView,
    DireccionLineaCreateView,
    DireccionLineaDeleteView,
    DireccionLineaUpdateView,
    OrganismosAdscritosListView,
    OrganismoAdscritoCreateView,
    OrganismoAdscritoDeleteView,
    OrganismoAdscritoUpdateView,
)

app_name = 'organizacion'

urlpatterns = [
    path('dependencias/', DependenciasListView.as_view(), name='dependencias-list'),
    path('dependencias/crear/', DependenciaCreateView.as_view(), name='dependencia-crear'),
    path('dependencias/<int:dependencia_id>/', DependenciaUpdateView.as_view(), name='dependencia-actualizar'),
    path('dependencias/<int:dependencia_id>/eliminar/', DependenciaDeleteView.as_view(), name='dependencia-eliminar'),
    path('direcciones-generales/', DireccionesGeneralesListView.as_view(), name='direcciones-generales-list'),
    path('direcciones-generales/crear/', DireccionGeneralCreateView.as_view(), name='direccion-general-crear'),
    path('direcciones-generales/<int:direccion_general_id>/', DireccionGeneralUpdateView.as_view(), name='direccion-general-actualizar'),
    path('direcciones-generales/<int:direccion_general_id>/eliminar/', DireccionGeneralDeleteView.as_view(), name='direccion-general-eliminar'),
    path('direcciones-linea/', DireccionesLineaListView.as_view(), name='direcciones-linea-list'),
    path('direcciones-linea/crear/', DireccionLineaCreateView.as_view(), name='direccion-linea-crear'),
    path('direcciones-linea/<int:direccion_linea_id>/', DireccionLineaUpdateView.as_view(), name='direccion-linea-actualizar'),
    path('direcciones-linea/<int:direccion_linea_id>/eliminar/', DireccionLineaDeleteView.as_view(), name='direccion-linea-eliminar'),
    path('coordinaciones/', CoordinacionesListView.as_view(), name='coordinaciones-list'),
    path('coordinaciones/crear/', CoordinacionCreateView.as_view(), name='coordinacion-crear'),
    path('coordinaciones/<int:coordinacion_id>/', CoordinacionUpdateView.as_view(), name='coordinacion-actualizar'),
    path('coordinaciones/<int:coordinacion_id>/eliminar/', CoordinacionDeleteView.as_view(), name='coordinacion-eliminar'),
    path('organismos-adscritos/', OrganismosAdscritosListView.as_view(), name='organismos-adscritos-list'),
    path('organismos-adscritos/crear/', OrganismoAdscritoCreateView.as_view(), name='organismo-adscrito-crear'),
    path('organismos-adscritos/<int:organismo_id>/', OrganismoAdscritoUpdateView.as_view(), name='organismo-adscrito-actualizar'),
    path('organismos-adscritos/<int:organismo_id>/eliminar/', OrganismoAdscritoDeleteView.as_view(), name='organismo-adscrito-eliminar'),
]
