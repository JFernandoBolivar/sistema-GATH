from django.urls import path
from . import views

app_name = "AUTOGESTION"
urlpatterns = [
    path("censo-vivienda/<str:cedula_empleado>/", views.registrar_censo_vivienda, name="registrar-censo-vivienda"),
    path("censo-vivienda/consultar/<str:cedula>/", views.consultar_censo_empleado, name="consultar-censo-empleado"),
    path("preguntas/", views.listar_preguntas_censo, name="listar-preguntas-censo"),
]
