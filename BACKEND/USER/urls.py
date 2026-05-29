from django.urls import path
from . import views


urlpatterns = [
    # ─── Authentication ───
    path('login/', views.login_view, name='api_login'),
    path('logout/', views.logout_view, name='api_logout'),
    path('refresh/', views.refresh_view, name='api_refresh'),
    path('me/', views.me_view, name='api_me'),
    path('cambiar-password/', views.cambiar_password_primera_vez, name='api_cambiar_password_primera_vez'),

    # ─── User Management ───
    path('registro/', views.register_view, name='api_register'),
    path('usuarios/', views.usuarios_lista, name='api_usuarios_lista'),
    path('roles/', views.list_rols, name="lista_roles"),
    path('departamentos/', views.list_departaments, name="lista_departamentos"),
    path('usuarios/<int:id>/', views.editar_usuario, name='api_editar_usuario'),
    path('usuarios/estado/<int:id>/', views.cambiar_estado_usuario, name='api_cambiar_estado_usuario'),
]