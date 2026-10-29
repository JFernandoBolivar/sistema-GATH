from django.urls import path

from apps.autogestion.presentation.views.autogestion_views import (
    CensoConsultarView,
    CensoEmpleadoView,
    CensoExcelView,
    MetricasCensoView,
    MiCarnetPdfView,
    MiExpedienteView,
    PreguntasCensoListView,
    ReporteCensoDependenciasView,
    SolicitarCarnetView,
)

from apps.autogestion.presentation.views.catalogos_views import CatalogoAutogestionView
from apps.autogestion.presentation.views.solicitud_bienestar_views import (
    BandejaView,
    ComparativoView,
    DatosComplementariosRRHHView,
    DecidirView,
    DetalleBienestarView,
    HabilitarVentanaView,
    ProrrogarVentanaView,
    RechazarView,
    SeccionConfigurarView,
)
from apps.autogestion.presentation.views.solicitud_trabajador_views import (
    BorradorView,
    EnviarSolicitudView,
    MisDatosComplementariosView,
    SeccionesView,
    SolicitudDetalleView,
    SolicitudesView,
    SoporteArchivoView,
    SoporteBorrarView,
    SoportesView,
)

app_name = 'autogestion'

urlpatterns = [
    # Actualización de datos por solicitud (trabajador ACTIVO)
    path('solicitudes/', SolicitudesView.as_view(), name='solicitudes'),
    path('solicitudes/<uuid:solicitud_id>/', SolicitudDetalleView.as_view(), name='solicitud-detalle'),
    path('solicitudes/<uuid:solicitud_id>/borrador/', BorradorView.as_view(), name='solicitud-borrador'),
    path('solicitudes/<uuid:solicitud_id>/soportes/', SoportesView.as_view(), name='solicitud-soportes'),
    path('solicitudes/<uuid:solicitud_id>/soportes/<uuid:soporte_id>/', SoporteBorrarView.as_view(), name='solicitud-soporte-borrar'),
    path('solicitudes/<uuid:solicitud_id>/enviar/', EnviarSolicitudView.as_view(), name='solicitud-enviar'),
    path('soportes/<uuid:soporte_id>/archivo/', SoporteArchivoView.as_view(), name='soporte-archivo'),
    path('catalogos/<str:clave>/', CatalogoAutogestionView.as_view(), name='catalogo'),
    path('secciones/', SeccionesView.as_view(), name='secciones'),
    path('mis-datos-complementarios/', MisDatosComplementariosView.as_view(), name='mis-datos-complementarios'),

    # Bienestar Social
    path('bienestar/solicitudes/', BandejaView.as_view(), name='bienestar-bandeja'),
    path('bienestar/solicitudes/<uuid:solicitud_id>/', DetalleBienestarView.as_view(), name='bienestar-detalle'),
    path('bienestar/solicitudes/<uuid:solicitud_id>/comparativo/', ComparativoView.as_view(), name='bienestar-comparativo'),
    path('bienestar/solicitudes/<uuid:solicitud_id>/habilitar/', HabilitarVentanaView.as_view(), name='bienestar-habilitar'),
    path('bienestar/solicitudes/<uuid:solicitud_id>/prorrogar/', ProrrogarVentanaView.as_view(), name='bienestar-prorrogar'),
    path('bienestar/solicitudes/<uuid:solicitud_id>/decidir/', DecidirView.as_view(), name='bienestar-decidir'),
    path('bienestar/solicitudes/<uuid:solicitud_id>/rechazar/', RechazarView.as_view(), name='bienestar-rechazar'),
    path('bienestar/secciones/<str:codigo>/', SeccionConfigurarView.as_view(), name='bienestar-seccion'),
    path('datos-complementarios/<str:cedula>/', DatosComplementariosRRHHView.as_view(), name='datos-complementarios'),

    # Mi expediente integral (datos de empleado y cargas familiares)
    path('mi-expediente/', MiExpedienteView.as_view(), name='mi-expediente'),
    path('solicitar-carnet/', SolicitarCarnetView.as_view(), name='solicitar-carnet'),
    path('mi-carnet/pdf/', MiCarnetPdfView.as_view(), name='mi-carnet-pdf'),

    # Preguntas activas
    path('preguntas/', PreguntasCensoListView.as_view(), name='censo-preguntas-list'),

    # Consultar censos (todos o por cédula)
    path('censo/consultar/', CensoConsultarView.as_view(), name='censo-consultar-todos'),
    path('censo/consultar/<str:cedula>/', CensoConsultarView.as_view(), name='censo-consultar-empleado'),
    path('censo-vivienda/consultar/', CensoConsultarView.as_view(), name='censo-vivienda-consultar-todos'),
    path('censo-vivienda/consultar/<str:cedula>/', CensoConsultarView.as_view(), name='censo-vivienda-consultar-empleado'),

    # Reporte dependencias para gráficos
    path('censo/reporte-dependencias/', ReporteCensoDependenciasView.as_view(), name='censo-reporte-dependencias'),
    path('censo-vivienda/reporte-dependencias/', ReporteCensoDependenciasView.as_view(), name='censo-vivienda-reporte-dependencias'),

    # Métricas agregadas
    path('censo/metricas/', MetricasCensoView.as_view(), name='censo-metricas'),

    # Exportación Excel
    path('censo/export/excel/', CensoExcelView.as_view(), name='censo-export-excel'),
    path('censo-vivienda/exportar-excel/', CensoExcelView.as_view(), name='censo-vivienda-exportar-excel'),

    # Registro y consulta individual por cédula
    path('censo/<str:cedula>/', CensoEmpleadoView.as_view(), name='censo-empleado'),
    path('censo-vivienda/<str:cedula>/', CensoEmpleadoView.as_view(), name='censo-vivienda-empleado'),
]
