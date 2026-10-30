from django.apps import AppConfig


class FeDeVidaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.fe_de_vida'
    verbose_name = 'Fe de Vida de Pasivos'
    # Los receivers que traducen los eventos a notificaciones y correo llegan con C6 (plantillas).
