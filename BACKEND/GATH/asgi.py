"""
ASGI config for GATH project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application
from django.urls import get_resolver

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'GATH.settings')

application = get_asgi_application()

# Igual que en wsgi.py: el master paga la carga del URLconf una sola vez.
get_resolver().url_patterns

