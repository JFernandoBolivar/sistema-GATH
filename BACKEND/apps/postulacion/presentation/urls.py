"""Rutas de postulación bajo `/api/v1/postulacion/` (B12: minúsculas y barra final)."""
from django.urls import path

from apps.postulacion.presentation.views.captacion_views import (
    AltaPostulanteView,
    AsignarView,
    BandejaView,
    ContactadoView,
    ExpedienteDetalleView,
    FotoExpedienteView,
    InformePsicofisicoView,
    PsicofisicoView,
    ReponerCredencialView,
    TransicionView,
)
from apps.postulacion.presentation.views.direccion_views import (
    IngresoConstanciaAdjuntoView,
    IngresoDetalleView,
    IngresoPuntoCuentaDocumentoView,
    IngresosView,
    IngresoTransicionView,
)
from apps.postulacion.presentation.views.postulante_views import (
    AccesoView,
    BorradorView,
    CambiarClaveView,
    EnviarView,
    MiExpedienteView,
    Ventana2CatalogosView,
    Ventana2FotoView,
    Ventana2View,
)
from apps.postulacion.presentation.views.presupuesto_views import (
    ConstanciaAdjuntoView,
    ConstanciaView,
    PuntoCuentaDocumentoView,
    ReservaView,
    SolicitudDetalleView,
    SolicitudesView,
    SolicitudTransicionView,
    VacantesView,
)

urlpatterns = [
    # Postulante (sesión de invitado)
    path('acceso/', AccesoView.as_view(), name='postulacion_acceso'),
    path('cambiar-clave/', CambiarClaveView.as_view(), name='postulacion_cambiar_clave'),
    path('mi-expediente/', MiExpedienteView.as_view(), name='postulacion_mi_expediente'),
    path('borrador/', BorradorView.as_view(), name='postulacion_borrador'),
    path('enviar/', EnviarView.as_view(), name='postulacion_enviar'),
    path('ventana2/', Ventana2View.as_view(), name='postulacion_ventana2'),
    path('ventana2/catalogos/', Ventana2CatalogosView.as_view(), name='postulacion_ventana2_catalogos'),
    path('ventana2/foto/', Ventana2FotoView.as_view(), name='postulacion_ventana2_foto'),
    # Captación (personal con permiso)
    path('postulantes/', AltaPostulanteView.as_view(), name='postulacion_alta'),
    path(
        'expedientes/<uuid:expediente_id>/reponer-credencial/', ReponerCredencialView.as_view(),
        name='postulacion_reponer_credencial',
    ),
    path('expedientes/', BandejaView.as_view(), name='postulacion_bandeja'),
    path('expedientes/<uuid:expediente_id>/', ExpedienteDetalleView.as_view(), name='postulacion_expediente_detalle'),
    path(
        'expedientes/<uuid:expediente_id>/transicion/', TransicionView.as_view(), name='postulacion_transicion',
    ),
    path(
        'expedientes/<uuid:expediente_id>/contactado/', ContactadoView.as_view(), name='postulacion_contactado',
    ),
    path('expedientes/<uuid:expediente_id>/asignar/', AsignarView.as_view(), name='postulacion_asignar'),
    path('expedientes/<uuid:expediente_id>/foto/', FotoExpedienteView.as_view(), name='postulacion_foto'),
    path(
        'expedientes/<uuid:expediente_id>/psicofisico/', PsicofisicoView.as_view(), name='postulacion_psicofisico',
    ),
    path(
        'expedientes/<uuid:expediente_id>/psicofisico/informe/', InformePsicofisicoView.as_view(),
        name='postulacion_psicofisico_informe',
    ),
    # Presupuesto (`ver_solicitudes`, `reservar_puesto`, `declarar_disponibilidad`, `devolver_solicitud`, `emitir_punto_cuenta`)
    path('solicitudes/', SolicitudesView.as_view(), name='postulacion_solicitudes'),
    path('solicitudes/<uuid:expediente_id>/', SolicitudDetalleView.as_view(), name='postulacion_solicitud_detalle'),
    path(
        'solicitudes/<uuid:expediente_id>/vacantes/', VacantesView.as_view(), name='postulacion_solicitud_vacantes',
    ),
    path('solicitudes/<uuid:expediente_id>/reserva/', ReservaView.as_view(), name='postulacion_solicitud_reserva'),
    path(
        'solicitudes/<uuid:expediente_id>/constancia/', ConstanciaView.as_view(), name='postulacion_solicitud_constancia',
    ),
    path(
        'solicitudes/<uuid:expediente_id>/constancia/adjunto/', ConstanciaAdjuntoView.as_view(),
        name='postulacion_solicitud_constancia_adjunto',
    ),
    path(
        'solicitudes/<uuid:expediente_id>/punto-cuenta/', PuntoCuentaDocumentoView.as_view(),
        name='postulacion_solicitud_punto_cuenta',
    ),
    path(
        'solicitudes/<uuid:expediente_id>/transicion/', SolicitudTransicionView.as_view(),
        name='postulacion_solicitud_transicion',
    ),
    # Dirección General (`ver_ingresos`, `aprobar_ingreso`)
    path('ingresos/', IngresosView.as_view(), name='postulacion_ingresos'),
    path('ingresos/<uuid:expediente_id>/', IngresoDetalleView.as_view(), name='postulacion_ingreso_detalle'),
    path(
        'ingresos/<uuid:expediente_id>/punto-cuenta/', IngresoPuntoCuentaDocumentoView.as_view(),
        name='postulacion_ingreso_punto_cuenta',
    ),
    path(
        'ingresos/<uuid:expediente_id>/constancia/adjunto/', IngresoConstanciaAdjuntoView.as_view(),
        name='postulacion_ingreso_constancia_adjunto',
    ),
    path(
        'ingresos/<uuid:expediente_id>/transicion/', IngresoTransicionView.as_view(), name='postulacion_ingreso_transicion',
    ),
]
