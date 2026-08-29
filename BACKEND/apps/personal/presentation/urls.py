from django.urls import path

from apps.personal.presentation.views.carga_masiva_views import (
    ImportarEmpleadosView,
    ImportarExpedienteCompletoView,
)
from apps.personal.presentation.views.personal_views import (
    EmpleadoDetailView,
    EmpleadoFotoView,
    EmpleadosListView,
)
from apps.personal.presentation.views.catalogos_soporte_views import (
    CarrerasListView,
    CodigosPostalesListView,
    CondicionesViviendaListView,
    GruposSanguineosListView,
    InstitucionesListView,
    MencionesListView,
    NivelesAcademicosListView,
    PoliticasListView,
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
    path('<str:cedula>/', EmpleadoDetailView.as_view(), name='empleado-detail'),
    path('<str:cedula>/foto/', EmpleadoFotoView.as_view(), name='empleado-foto'),
]

