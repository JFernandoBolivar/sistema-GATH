from django.urls import path

from apps.puntocuenta.presentation.views.punto_cuenta_views import (
    PuntoCuentaDocumentoView,
    PuntoCuentaListView,
)

app_name = 'puntocuenta'

urlpatterns = [
    path('', PuntoCuentaListView.as_view(), name='puntocuenta_list'),
    path('<int:id>/documento/', PuntoCuentaDocumentoView.as_view(), name='puntocuenta_documento'),
]
