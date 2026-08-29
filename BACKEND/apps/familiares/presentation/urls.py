from django.urls import path

from apps.familiares.presentation.views.familiares_views import (
    DocumentosFamiliarListView,
    FamiliarDetailView,
    FamiliaresEmpleadoListView,
)

app_name = 'familiares'

urlpatterns = [
    path('empleado/<str:cedula>/', FamiliaresEmpleadoListView.as_view(), name='familiares-empleado-list'),
    path('<int:familiar_id>/', FamiliarDetailView.as_view(), name='familiar-detail'),
    path('<int:familiar_id>/documentos/', DocumentosFamiliarListView.as_view(), name='familiar-documentos-list'),
]
