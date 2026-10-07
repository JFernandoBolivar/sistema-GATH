from django.urls import path

from apps.personal.presentation.views.carga_masiva_views import (
    ImportarEmpleadosView,
    ImportarExpedienteCompletoView,
)
from apps.personal.presentation.views.personal_views import (
    EmpleadoDetailView,
    EmpleadoDetallePdfView,
    EmpleadoFotoView,
    EmpleadosListView,
)
from apps.personal.presentation.views.catalogos_soporte_views import (
    AlergiaCategoriaDetailView,
    AlergiaDetailView,
    AlergiasCategoriasView,
    AlergiasListView,
    CapacitacionesListView,
    CarrerasListView,
    CodigosPostalesListView,
    CondicionesViviendaListView,
    DiscapacidadCategoriaDetailView,
    DiscapacidadDetailView,
    DiscapacidadesCategoriasView,
    DiscapacidadesListView,
    GruposCapacitacionListView,
    GruposSanguineosListView,
    InstitucionesListView,
    MencionesListView,
    NivelesAcademicosListView,
    PatologiaCategoriaDetailView,
    PatologiaDetailView,
    PatologiasCategoriasView,
    PatologiasListView,
    PoliticasListView,
    RegionTallaDetailView,
    RegionesTallaListView,
    TallaDetailView,
    TallasListView,
    TipoPrendaDetailView,
    TiposPrendaListView,
)

app_name = 'personal'

urlpatterns = [
    path('', EmpleadosListView.as_view(), name='empleados-list'),
    path('carga-masiva/basica/', ImportarEmpleadosView.as_view(), name='carga-masiva-basica'),
    path('carga-masiva/expediente/', ImportarExpedienteCompletoView.as_view(), name='carga-masiva-expediente'),
    path('catalogos/politicas/', PoliticasListView.as_view(), name='catalogos-politicas'),
    path('catalogos/condiciones-vivienda/', CondicionesViviendaListView.as_view(), name='catalogos-condiciones-vivienda'),
    path('catalogos/codigos-postales/', CodigosPostalesListView.as_view(), name='catalogos-codigos-postales'),
    path('catalogos/grupos-sanguineos/', GruposSanguineosListView.as_view(), name='catalogos-grupos-sanguineos'),
    path('catalogos/niveles-academicos/', NivelesAcademicosListView.as_view(), name='catalogos-niveles-academicos'),
    path('catalogos/carreras/', CarrerasListView.as_view(), name='catalogos-carreras'),
    path('catalogos/menciones/', MencionesListView.as_view(), name='catalogos-menciones'),
    path('catalogos/instituciones/', InstitucionesListView.as_view(), name='catalogos-instituciones'),
    path('catalogos/capacitaciones/', CapacitacionesListView.as_view(), name='catalogos-capacitaciones'),
    path('catalogos/grupos-capacitacion/', GruposCapacitacionListView.as_view(), name='catalogos-grupos-capacitacion'),

    # Tipos de Prenda
    path('catalogos/tipos-prenda/', TiposPrendaListView.as_view(), name='catalogos-tipos-prenda'),
    path('catalogos/tipos-prenda/<int:pk>/', TipoPrendaDetailView.as_view(), name='catalogos-tipo-prenda-detail'),

    # Regiones de Talla
    path('catalogos/regiones-talla/', RegionesTallaListView.as_view(), name='catalogos-regiones-talla'),
    path('catalogos/regiones-talla/<int:pk>/', RegionTallaDetailView.as_view(), name='catalogos-region-talla-detail'),

    # Tallas
    path('catalogos/tallas/', TallasListView.as_view(), name='catalogos-tallas'),
    path('catalogos/tallas/<int:pk>/', TallaDetailView.as_view(), name='catalogos-talla-detail'),

    # Alergias y Categorías
    path('catalogos/alergias/categorias/', AlergiasCategoriasView.as_view(), name='catalogos-alergias-categorias'),
    path('catalogos/alergias/categorias/<int:pk>/', AlergiaCategoriaDetailView.as_view(), name='catalogos-alergias-categoria-detail'),
    path('catalogos/alergias/', AlergiasListView.as_view(), name='catalogos-alergias'),
    path('catalogos/alergias/<int:pk>/', AlergiaDetailView.as_view(), name='catalogos-alergia-detail'),

    # Patologías y Categorías
    path('catalogos/patologias/categorias/', PatologiasCategoriasView.as_view(), name='catalogos-patologias-categorias'),
    path('catalogos/patologias/categorias/<int:pk>/', PatologiaCategoriaDetailView.as_view(), name='catalogos-patologias-categoria-detail'),
    path('catalogos/patologias/', PatologiasListView.as_view(), name='catalogos-patologias'),
    path('catalogos/patologias/<int:pk>/', PatologiaDetailView.as_view(), name='catalogos-patologia-detail'),

    # Discapacidades y Categorías
    path('catalogos/discapacidades/categorias/', DiscapacidadesCategoriasView.as_view(), name='catalogos-discapacidades-categorias'),
    path('catalogos/discapacidades/categorias/<int:pk>/', DiscapacidadCategoriaDetailView.as_view(), name='catalogos-discapacidades-categoria-detail'),
    path('catalogos/discapacidades/', DiscapacidadesListView.as_view(), name='catalogos-discapacidades'),
    path('catalogos/discapacidades/<int:pk>/', DiscapacidadDetailView.as_view(), name='catalogos-discapacidad-detail'),

    # Detalle de empleado y foto
    path('<str:cedula>/', EmpleadoDetailView.as_view(), name='empleado-detail'),
    path('<str:cedula>/pdf/', EmpleadoDetallePdfView.as_view(), name='empleado-detail-pdf'),
    path('<str:cedula>/foto/', EmpleadoFotoView.as_view(), name='empleado-foto'),
]
