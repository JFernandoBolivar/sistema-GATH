from django.urls import path

from apps.carnetizacion.presentation.views.carnetizacion_views import (
    ActivarPlantillaView,
    CarnetActualizarVistaPreviaView,
    CarnetBuscarPersonalView,
    CarnetGenerarView,
    CarnetPdfView,
    CarnetsListView,
    CarnetSubirFotoView,
    EstadisticasCarnetsView,
    MotivosEmisionListView,
    PlantillaCreateView,
    PlantillasListView,
    RevocarCarnetView,
    ValidarCarnetHashView,
    ValidarCarnetIdView,
)

app_name = 'carnetizacion'

urlpatterns = [
    path('', CarnetsListView.as_view(), name='carnets-list'),
    path('buscar/', CarnetBuscarPersonalView.as_view(), name='carnet-buscar'),
    path('motivos/', MotivosEmisionListView.as_view(), name='motivos-list'),
    path('actualizar-vista-previa/<str:cedula>/', CarnetActualizarVistaPreviaView.as_view(), name='carnet-actualizar-vista-previa'),
    path('subir-foto/<str:cedula>/', CarnetSubirFotoView.as_view(), name='carnet-subir-foto'),
    path('generar/<str:cedula>/', CarnetGenerarView.as_view(), name='carnet-generar'),
    path('estadisticas/', EstadisticasCarnetsView.as_view(), name='carnets-estadisticas'),
    path('plantillas/', PlantillasListView.as_view(), name='plantillas-list'),
    path('plantillas/crear/', PlantillaCreateView.as_view(), name='plantilla-crear'),
    path('plantillas/<int:plantilla_id>/activar/', ActivarPlantillaView.as_view(), name='plantilla-activar'),
    path('validar/hash/<str:security_hash>/', ValidarCarnetHashView.as_view(), name='carnet-validar-hash'),
    path('validar/<int:carnet_id>/', ValidarCarnetIdView.as_view(), name='carnet-validar-id'),
    path('<int:carnet_id>/pdf/', CarnetPdfView.as_view(), name='carnet-pdf'),
    path('<int:carnet_id>/revocar/', RevocarCarnetView.as_view(), name='carnet-revocar'),
]
