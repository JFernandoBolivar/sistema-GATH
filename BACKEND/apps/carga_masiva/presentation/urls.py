from django.urls import path

from apps.carga_masiva.presentation.views import (
    AplicarCargaMasivaView,
    AprobarCargaMasivaView,
    CargaMasivaDetalleView,
    CargasMasivasView,
    ConfirmarFilasCargaMasivaView,
    PlantillaCargaMasivaView,
    RechazarCargaMasivaView,
    ResultadosCargaMasivaView,
    RevertirCargaMasivaView,
)

app_name = 'carga_masiva'

urlpatterns = [
    path('plantilla/', PlantillaCargaMasivaView.as_view(), name='plantilla'),
    path('cargas/', CargasMasivasView.as_view(), name='cargas'),
    path('cargas/<uuid:carga_id>/', CargaMasivaDetalleView.as_view(), name='carga'),
    path('cargas/<uuid:carga_id>/resultados/', ResultadosCargaMasivaView.as_view(), name='resultados'),
    path('cargas/<uuid:carga_id>/confirmar/', ConfirmarFilasCargaMasivaView.as_view(), name='confirmar'),
    path('cargas/<uuid:carga_id>/aplicar/', AplicarCargaMasivaView.as_view(), name='aplicar'),
    path('cargas/<uuid:carga_id>/aprobar/', AprobarCargaMasivaView.as_view(), name='aprobar'),
    path('cargas/<uuid:carga_id>/rechazar/', RechazarCargaMasivaView.as_view(), name='rechazar'),
    path('cargas/<uuid:carga_id>/revertir/', RevertirCargaMasivaView.as_view(), name='revertir'),
]
