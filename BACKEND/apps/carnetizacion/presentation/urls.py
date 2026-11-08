from django.urls import path

from apps.carnetizacion.presentation.views.credenciales_externas_views import (
    CarnetQrImagenView,
    CredencialExternaAnularView,
    CredencialExternaDetailView,
    CredencialExternaDevolverView,
    CredencialExternaEnviarView,
    CredencialExternaPdfView,
    CredencialesExternasListView,
    CredencialesLotePdfView,
    CredencialesTemporalesListView,
)
from apps.carnetizacion.presentation.views.evento_views import (
    EventoCategoriasView,
    EventoControlEntradaCheckInView,
    EventoCredencialPdfView,
    EventoDetalleView,
    EventoEmitirLoteView,
    EventoEnviarCorreoView,
    EventoInvitadoDetalleView,
    EventoInvitadosImportarView,
    EventoInvitadosListView,
    EventoPanelView,
    EventosListView,
    EventoZonasView,
)
from apps.carnetizacion.presentation.views.carnetizacion_views import (
    ActivarPlantillaView,
    AutogestionPrivacidadCarnetView,
    CampoCredencialListView,
    CampoPersonalizadoCreateView,
    CampoPersonalizadoDetailView,
    CarnetActualizarVistaPreviaView,
    CarnetBuscarPersonalView,
    CarnetGenerarView,
    CarnetPdfView,
    CarnetsListView,
    CarnetSubirFotoView,
    ElementoBibliotecaArchivoView,
    ElementoBibliotecaDetailView,
    ElementoBibliotecaListView,
    EstadisticasCarnetsView,
    FichaQrMedicaView,
    FichaQrPublicaView,
    MotivosEmisionListView,
    PlantillaCreateView,
    PlantillaImagenView,
    PlantillaMotorActivaView,
    PlantillaMotorActivarView,
    PlantillaMotorDetalleView,
    PlantillaMotorListView,
    PlantillaMotorPublicarView,
    PlantillaMotorVersionesView,
    PlantillasListView,
    RevocarCarnetView,
    TiposCredencialListView,
    ValidarCarnetHashView,
    ValidarCarnetIdView,
)

app_name = 'carnetizacion'

urlpatterns = [
    # Carnets
    path('', CarnetsListView.as_view(), name='carnets-list'),
    path('buscar/', CarnetBuscarPersonalView.as_view(), name='carnet-buscar'),
    path('motivos/', MotivosEmisionListView.as_view(), name='motivos-list'),
    path('actualizar-vista-previa/<str:cedula>/', CarnetActualizarVistaPreviaView.as_view(), name='carnet-actualizar-vista-previa'),
    path('subir-foto/<str:cedula>/', CarnetSubirFotoView.as_view(), name='carnet-subir-foto'),
    path('generar/<str:cedula>/', CarnetGenerarView.as_view(), name='carnet-generar'),
    path('estadisticas/', EstadisticasCarnetsView.as_view(), name='carnets-estadisticas'),
    path('validar/hash/<str:security_hash>/', ValidarCarnetHashView.as_view(), name='carnet-validar-hash'),
    path('validar/<int:carnet_id>/', ValidarCarnetIdView.as_view(), name='carnet-validar-id'),
    path('<int:carnet_id>/pdf/', CarnetPdfView.as_view(), name='carnet-pdf'),
    path('<int:carnet_id>/revocar/', RevocarCarnetView.as_view(), name='carnet-revocar'),

    # Motor de Plantillas y Catálogo (O44 - E3)
    path('tipos-credencial/', TiposCredencialListView.as_view(), name='tipos-credencial-list'),
    path('plantillas-motor/', PlantillaMotorListView.as_view(), name='plantillas-motor-list'),
    path('plantillas-motor/activa/', PlantillaMotorActivaView.as_view(), name='plantilla-motor-activa'),
    path('plantillas-motor/<str:plantilla_id>/', PlantillaMotorDetalleView.as_view(), name='plantilla-motor-detalle'),
    path('plantillas-motor/<str:plantilla_id>/publicar/', PlantillaMotorPublicarView.as_view(), name='plantilla-motor-publicar'),
    path('plantillas-motor/<str:plantilla_id>/activar/', PlantillaMotorActivarView.as_view(), name='plantilla-motor-activar'),
    path('plantillas-motor/<str:plantilla_id>/versiones/', PlantillaMotorVersionesView.as_view(), name='plantilla-motor-versiones'),

    # Biblioteca Compartida de Medios (O44 - E4)
    path('biblioteca/', ElementoBibliotecaListView.as_view(), name='biblioteca-list'),
    path('biblioteca/<str:elemento_id>/', ElementoBibliotecaDetailView.as_view(), name='biblioteca-detail'),
    path('biblioteca/<str:elemento_id>/archivo/', ElementoBibliotecaArchivoView.as_view(), name='biblioteca-archivo'),

    # Registro de Campos Autorizados y Personalizados (O44 - E5)
    path('campos/', CampoCredencialListView.as_view(), name='campos-list'),
    path('campos/personalizados/', CampoPersonalizadoCreateView.as_view(), name='campos-personalizados-create'),
    path('campos/personalizados/<str:codigo>/', CampoPersonalizadoDetailView.as_view(), name='campos-personalizados-detail'),

    # QR y Privacidad por Dato (O44 - E9)
    path('public/qr/<str:security_hash>/', FichaQrPublicaView.as_view(), name='carnet-qr-publico'),
    path('public/qr/<str:security_hash>/medica/', FichaQrMedicaView.as_view(), name='carnet-qr-medica'),
    path('autogestion/privacidad/', AutogestionPrivacidadCarnetView.as_view(), name='carnet-autogestion-privacidad'),

    # Credenciales externas y temporales (O45-A)
    path('credenciales-externas/', CredencialesExternasListView.as_view(), name='credenciales-externas-list'),
    path('credenciales-externas/lote/pdf/', CredencialesLotePdfView.as_view(), name='credenciales-externas-lote-pdf'),
    path('credenciales-externas/<str:credencial_id>/', CredencialExternaDetailView.as_view(), name='credencial-externa-detail'),
    path('credenciales-externas/<str:credencial_id>/pdf/', CredencialExternaPdfView.as_view(), name='credencial-externa-pdf'),
    path('credenciales-externas/<str:credencial_id>/devolver/', CredencialExternaDevolverView.as_view(), name='credencial-externa-devolver'),
    path('credenciales-externas/<str:credencial_id>/anular/', CredencialExternaAnularView.as_view(), name='credencial-externa-anular'),
    path('credenciales-externas/<str:credencial_id>/enviar/', CredencialExternaEnviarView.as_view(), name='credencial-externa-enviar'),
    path('credenciales-temporales/', CredencialesTemporalesListView.as_view(), name='credenciales-temporales-list'),
    path('public/qr/<str:security_hash>/imagen/', CarnetQrImagenView.as_view(), name='carnet-qr-imagen'),

    # Eventos, Invitados y Control de Entrada con QR (O45-B)
    path('eventos/', EventosListView.as_view(), name='eventos-list'),
    path('eventos/<str:pk>/', EventoDetalleView.as_view(), name='evento-detalle'),
    path('eventos/<str:evento_id>/categorias/', EventoCategoriasView.as_view(), name='evento-categorias'),
    path('eventos/<str:evento_id>/zonas/', EventoZonasView.as_view(), name='evento-zonas'),
    path('eventos/<str:evento_id>/invitados/', EventoInvitadosListView.as_view(), name='evento-invitados-list'),
    path('eventos/<str:evento_id>/invitados/importar/', EventoInvitadosImportarView.as_view(), name='evento-invitados-importar'),
    path('eventos/<str:evento_id>/emitir-lote/', EventoEmitirLoteView.as_view(), name='evento-emitir-lote'),
    path('eventos/<str:evento_id>/enviar-correo/', EventoEnviarCorreoView.as_view(), name='evento-enviar-correo'),
    path('eventos/<str:evento_id>/pdf/', EventoCredencialPdfView.as_view(), name='evento-pdf'),
    path('eventos/<str:evento_id>/panel/', EventoPanelView.as_view(), name='evento-panel'),
    path('eventos/invitados/<str:pk>/', EventoInvitadoDetalleView.as_view(), name='evento-invitado-detalle'),
    path('control-eventos/check-in/', EventoControlEntradaCheckInView.as_view(), name='evento-checkin'),

    # Plantillas Legacy
    path('plantillas/', PlantillasListView.as_view(), name='plantillas-list'),
    path('plantillas/crear/', PlantillaCreateView.as_view(), name='plantilla-crear'),
    path('plantillas/<int:plantilla_id>/imagen/', PlantillaImagenView.as_view(), name='plantilla-imagen'),
    path('plantillas/<int:plantilla_id>/activar/', ActivarPlantillaView.as_view(), name='plantilla-activar'),
]
