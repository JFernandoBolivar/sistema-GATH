from django.urls import path

from apps.fe_de_vida.presentation.views.cobertura_views import CoberturaPasivosView, VerificarConstanciaView
from apps.fe_de_vida.presentation.views.pasivo_views import (
    BorradorView,
    EnviarView,
    EvidenciaView,
    IniciarSolicitudView,
    MiConstanciaView,
    MisSolicitudesView,
    MiSolicitudView,
    ProcesoVigenteView,
)
from apps.fe_de_vida.presentation.views.proceso_views import (
    AbrirProcesoView,
    CerrarProcesoView,
    ProcesoView,
    ProcesosView,
    TiposPensionView,
    ProrrogasView,
)
from apps.fe_de_vida.presentation.views.revision_views import (
    AprobarDirectoView,
    BandejaView,
    CheckView,
    DetalleRevisionView,
    DevolverView,
    EvidenciaUrlView,
    RechazarView,
)

app_name = 'fe_de_vida'

urlpatterns = [
    # Pasivo (permiso fe_de_vida.* + condición PASIVO)
    path('procesos/vigente/', ProcesoVigenteView.as_view(), name='proceso_vigente'),
    path('procesos/vigente/solicitud/', IniciarSolicitudView.as_view(), name='iniciar_solicitud'),
    path('mis-solicitudes/', MisSolicitudesView.as_view(), name='mis_solicitudes'),
    path('mis-solicitudes/<uuid:solicitud_id>/', MiSolicitudView.as_view(), name='mi_solicitud'),
    path('mis-solicitudes/<uuid:solicitud_id>/borrador/', BorradorView.as_view(), name='borrador'),
    path('mis-solicitudes/<uuid:solicitud_id>/evidencia/', EvidenciaView.as_view(), name='subir_evidencia'),
    path('mis-solicitudes/<uuid:solicitud_id>/enviar/', EnviarView.as_view(), name='enviar'),
    path('mis-solicitudes/<uuid:solicitud_id>/constancia/', MiConstanciaView.as_view(), name='mi_constancia'),
    # Bienestar
    path('solicitudes/', BandejaView.as_view(), name='bandeja'),
    path('solicitudes/<uuid:solicitud_id>/', DetalleRevisionView.as_view(), name='detalle_revision'),
    path('solicitudes/<uuid:solicitud_id>/evidencia/', EvidenciaUrlView.as_view(), name='url_evidencia'),
    path('solicitudes/<uuid:solicitud_id>/check/', CheckView.as_view(), name='check'),
    path('solicitudes/<uuid:solicitud_id>/aprobar-directo/', AprobarDirectoView.as_view(), name='aprobar_directo'),
    path('solicitudes/<uuid:solicitud_id>/rechazar/', RechazarView.as_view(), name='rechazar'),
    path('solicitudes/<uuid:solicitud_id>/devolver/', DevolverView.as_view(), name='devolver'),
    # Procesos y prórrogas
    path('procesos/', ProcesosView.as_view(), name='procesos'),
    path('procesos/tipos-pension/', TiposPensionView.as_view(), name='tipos_pension'),
    path('procesos/<uuid:proceso_id>/', ProcesoView.as_view(), name='proceso'),
    path('procesos/<uuid:proceso_id>/abrir/', AbrirProcesoView.as_view(), name='abrir_proceso'),
    path('procesos/<uuid:proceso_id>/cerrar/', CerrarProcesoView.as_view(), name='cerrar_proceso'),
    path('procesos/<uuid:proceso_id>/prorrogas/', ProrrogasView.as_view(), name='prorrogas'),
    # Cobertura y verificación
    path('cobertura/pasivos/', CoberturaPasivosView.as_view(), name='cobertura_pasivos'),
    path('constancias/verificar/<str:codigo>/', VerificarConstanciaView.as_view(), name='verificar_constancia'),
]
