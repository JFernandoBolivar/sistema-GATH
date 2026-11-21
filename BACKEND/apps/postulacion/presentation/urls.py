"""Rutas de postulación bajo `/api/v1/postulacion/` (B12: minúsculas y barra final)."""
from django.urls import path

from apps.postulacion.presentation.views.captacion_views import AltaPostulanteView, ReponerCredencialView
from apps.postulacion.presentation.views.postulante_views import (
    AccesoView,
    BorradorView,
    CambiarClaveView,
    EnviarView,
    MiExpedienteView,
)

urlpatterns = [
    # Postulante (sesión de invitado)
    path('acceso/', AccesoView.as_view(), name='postulacion_acceso'),
    path('cambiar-clave/', CambiarClaveView.as_view(), name='postulacion_cambiar_clave'),
    path('mi-expediente/', MiExpedienteView.as_view(), name='postulacion_mi_expediente'),
    path('borrador/', BorradorView.as_view(), name='postulacion_borrador'),
    path('enviar/', EnviarView.as_view(), name='postulacion_enviar'),
    # Captación (personal con permiso)
    path('postulantes/', AltaPostulanteView.as_view(), name='postulacion_alta'),
    path(
        'expedientes/<uuid:expediente_id>/reponer-credencial/', ReponerCredencialView.as_view(),
        name='postulacion_reponer_credencial',
    ),
]
