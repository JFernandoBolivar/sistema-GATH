"""
WSGI config for GATH project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application
from django.urls import get_resolver

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'GATH.settings')

application = get_wsgi_application()

# gunicorn --preload importa este modulo una sola vez en el master. Forzamos
# aqui la carga del URLconf para que los workers no paguen la importacion
# perezosa de todas las vistas en su primera peticion (7-9 s medidos).
get_resolver().url_patterns

