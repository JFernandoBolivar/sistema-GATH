from django.urls import path

from apps.notificaciones.presentation.views.notificaciones_views import (
    ConteoNoLeidasView,
    LeerNotificacionView,
    LeerTodasView,
    NotificacionesView,
)

app_name = 'notificaciones'

urlpatterns = [
    path('', NotificacionesView.as_view(), name='listar'),
    path('conteo/', ConteoNoLeidasView.as_view(), name='conteo'),
    path('leer-todas/', LeerTodasView.as_view(), name='leer-todas'),
    path('<uuid:notificacion_id>/leer/', LeerNotificacionView.as_view(), name='leer'),
]
