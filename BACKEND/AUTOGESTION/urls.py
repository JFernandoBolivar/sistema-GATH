from django.urls import path
from . import views

app_name = "AUTOGESTION"
urlpatterns = [
    path("censo-vivienda/consultar/<str:cedula>/", views.consultar_censo_empleado, name="consultar-censo-empleado"),
    path("censo-vivienda/consultar/", views.consultar_todos_censos, name="consultar-todos-censos"),
    path("censo-vivienda/exportar-excel/", views.exportar_censo_excel, name="exportar-censo-excel"),
    path("censo-vivienda/<str:cedula_empleado>/", views.registrar_censo_vivienda, name="registrar-censo-vivienda"),
    path("preguntas/", views.listar_preguntas_censo, name="listar-preguntas-censo"),
]
