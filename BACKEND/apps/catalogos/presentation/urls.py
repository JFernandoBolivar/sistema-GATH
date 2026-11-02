from django.urls import path

from apps.catalogos.presentation.views.catalogos_views import (
    CategoriasMovimientoListView,
    EstadosCivilesListView,
    EstadosListView,
    EstatusListView,
    GradosListView,
    MunicipiosListView,
    ParentescosListView,
    ParroquiasListView,
    RegionesListView,
    SexosListView,
    TiposMovimientoListView,
    TiposNominaListView,
    TiposPersonalListView,
    TiposProcedenciaListView,
    NacionalidadesListView,
)

app_name = 'catalogos'

urlpatterns = [
    path('regiones/', RegionesListView.as_view(), name='regiones-list'),
    path('estados/', EstadosListView.as_view(), name='estados-list'),
    path('municipios/', MunicipiosListView.as_view(), name='municipios-list'),
    path('parroquias/', ParroquiasListView.as_view(), name='parroquias-list'),
    path('sexos/', SexosListView.as_view(), name='sexos-list'),
    path('estatus/', EstatusListView.as_view(), name='estatus-list'),
    path('tipos-personal/', TiposPersonalListView.as_view(), name='tipos-personal-list'),
    path('tipos-nomina/', TiposNominaListView.as_view(), name='tipos-nomina-list'),
    path('parentescos/', ParentescosListView.as_view(), name='parentescos-list'),
    path('tipos-procedencia/', TiposProcedenciaListView.as_view(), name='tipos-procedencia-list'),
    path('grados/', GradosListView.as_view(), name='grados-list'),
    path('estados-civiles/', EstadosCivilesListView.as_view(), name='estados-civiles-list'),
    path('categorias-movimiento/', CategoriasMovimientoListView.as_view(), name='categorias-movimiento-list'),
    path('tipos-movimiento/', TiposMovimientoListView.as_view(), name='tipos-movimiento-list'),
    path('nacionalidades/', NacionalidadesListView.as_view(), name='nacionalidades-list'),
]
