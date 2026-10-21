"""
Rutas del módulo identidad (B3.1, regla B12: /api/v1/, minúsculas, barra final).
"""
from django.urls import path

from apps.identidad.presentation.views.auth_views import (
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    RestablecerPasswordView,
    SolicitarRecuperacionPasswordView,
)
from apps.identidad.presentation.views.cuenta_views import (
    CambiarPasswordView,
    UsuarioCambiarEstadoView,
    UsuarioEditarView,
    UsuarioListView,
    UsuarioRegistrarView,
)
from apps.identidad.presentation.views.departamento_views import DepartamentoListView
from apps.identidad.presentation.views.permiso_views import (
    CatalogoPermisosView,
    PermisosDeCuentaView,
)
from apps.identidad.presentation.views.rol_catalogo_views import (
    RolActualizarView,
    RolEliminarView,
    RolListCrearView,
)

app_name = 'identidad'

urlpatterns = [
    # ─── Autenticación (B12, R-11) ───
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('auth/cambiar-password/', CambiarPasswordView.as_view(), name='auth-cambiar-password'),
    path('auth/solicitar-recuperacion/', SolicitarRecuperacionPasswordView.as_view(), name='auth-solicitar-recuperacion'),
    path('auth/restablecer-password/', RestablecerPasswordView.as_view(), name='auth-restablecer-password'),


    # ─── Catálogo y resolución de permisos (B3.1/B3.2) ───
    path('permisos/', CatalogoPermisosView.as_view(), name='lista-permisos'),
    path(
        'cuentas/<str:cedula>/permisos/',
        PermisosDeCuentaView.as_view(),
        name='permisos-de-cuenta',
    ),

    # ─── Gestión de usuarios (CRIT-04, CRIT-05) ───
    path('usuarios/', UsuarioListView.as_view(), name='usuarios-lista'),
    path('usuarios/registro/', UsuarioRegistrarView.as_view(), name='usuarios-registro'),
    path('usuarios/cambiar-password/', CambiarPasswordView.as_view(), name='usuarios-cambiar-password'),
    path('usuarios/<int:id>/', UsuarioEditarView.as_view(), name='usuarios-editar'),
    path('usuarios/<int:id>/estado/', UsuarioCambiarEstadoView.as_view(), name='usuarios-cambiar-estado'),

    # ─── Catálogo de roles (CRIT-12) ───
    path('roles/', RolListCrearView.as_view(), name='roles-lista-crear'),
    path('roles/<int:id>/', RolActualizarView.as_view(), name='roles-actualizar'),
    path('roles/<int:id>/eliminar/', RolEliminarView.as_view(), name='roles-eliminar'),

    # ─── Catálogo de departamentos ───
    path('departamentos/', DepartamentoListView.as_view(), name='departamentos-lista'),
]
