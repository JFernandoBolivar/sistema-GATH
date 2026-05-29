from django.urls import path
from . import views

urlpatterns = [
    path('api/buscar/', views.api_buscar_personal, name='api_buscar_personal'),
    path('api/cargos/', views.api_listar_cargos, name='api_listar_cargos'),
    path('api/departamentos/', views.api_listar_departamentos, name='api_listar_departamentos'),
    path('actualizar-vista-previa/<str:cedula>/', views.api_actualizar_vista_previa, name='api_actualizar_vista_previa'),
    path('subir-foto/<str:cedula>/', views.api_subir_foto, name='api_subir_foto'),
    path('registrar-solicitud/<str:cedula>/', views.api_registrar_solicitud, name='api_registrar_solicitud'),
    path('generar/<str:cedula>/', views.api_generar_carnet, name='api_generar_carnet'),
    path('validar/<int:carnet_id>/', views.api_validar_carnet, name='api_validar_carnet'),
    path('estadisticas/', views.api_estadisticas, name='api_estadisticas'),
    path('api/motivos/', views.api_listar_motivos, name='api_listar_motivos'),
    path('api/plantillas/', views.api_listar_plantillas, name='api_listar_plantillas'),
    path('api/plantillas/crear/', views.api_crear_plantilla, name='api_crear_plantilla'),
    path('api/plantillas/<int:plantilla_id>/activar/', views.api_activar_plantilla, name='api_activar_plantilla'),
]
