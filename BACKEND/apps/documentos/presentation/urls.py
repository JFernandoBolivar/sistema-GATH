from django.urls import path

from apps.documentos.presentation.views import documentos_views as v

app_name = 'documentos'

urlpatterns = [
    path('variables/', v.VariablesView.as_view(), name='variables'),
    path('plantillas/', v.PlantillasView.as_view(), name='plantillas'),
    path('plantillas/<uuid:id>/', v.PlantillaDetalleView.as_view(), name='plantilla_detalle'),
    path('plantillas/<uuid:id>/publicar/', v.PlantillaPublicarView.as_view(), name='plantilla_publicar'),
    path('plantillas/<uuid:id>/duplicar/', v.PlantillaDuplicarView.as_view(), name='plantilla_duplicar'),
    path('plantillas/<uuid:id>/activar/', v.PlantillaActivarView.as_view(), name='plantilla_activar'),
    path('plantillas/<uuid:id>/versiones/', v.PlantillaVersionesView.as_view(), name='plantilla_versiones'),
    path('plantillas/<uuid:id>/fondo/', v.PlantillaFondoView.as_view(), name='plantilla_fondo'),
    path('plantillas/<uuid:id>/fondo/paginas/<int:numero>/', v.PlantillaFondoPaginaView.as_view(), name='plantilla_fondo_pagina'),
    path('plantillas/<uuid:id>/logo/', v.PlantillaLogoView.as_view(), name='plantilla_logo'),
    path('plantillas/<uuid:id>/vista-previa/', v.PlantillaVistaPreviaView.as_view(), name='plantilla_vista_previa'),
    path('bajo-demanda/', v.BajoDemandaView.as_view(), name='bajo_demanda'),
    path('bajo-demanda/generar/', v.BajoDemandaGenerarView.as_view(), name='bajo_demanda_generar'),
    path('generados/<uuid:id>/', v.DocumentoGeneradoView.as_view(), name='generado'),
    path('generados/<uuid:id>/archivo/', v.DocumentoGeneradoArchivoView.as_view(), name='generado_archivo'),
]
