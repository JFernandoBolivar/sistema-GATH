from django.apps import AppConfig


class NotificacionesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notificaciones'
    verbose_name = 'Notificaciones y Correo'

    def ready(self):
        from apps.notificaciones.infrastructure.providers.registro import registrar_notificador_en_kernel

        registrar_notificador_en_kernel()
