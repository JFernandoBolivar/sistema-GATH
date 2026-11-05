from django.urls import path

from apps.puntocuenta.presentation.views.punto_cuenta_views import (
    PuntoCuentaConfiguracionView,
    PuntoCuentaDocumentoArchivoView,
    PuntoCuentaDocumentoView,
    PuntoCuentaListView,
    PuntoCuentaVistaPreviaPdfView,
)

app_name = 'puntocuenta'

urlpatterns = [
    path('', PuntoCuentaListView.as_view(), name='puntocuenta_list'),
    path('configuracion/', PuntoCuentaConfiguracionView.as_view(), name='puntocuenta_configuracion'),
    path('configuracion/vista-previa/', PuntoCuentaVistaPreviaPdfView.as_view(), name='puntocuenta_vista_previa'),
    path('<str:id>/documento/', PuntoCuentaDocumentoView.as_view(), name='puntocuenta_documento'),
    path('<str:id>/documento/archivo/', PuntoCuentaDocumentoArchivoView.as_view(), name='puntocuenta_documento_archivo'),
]
