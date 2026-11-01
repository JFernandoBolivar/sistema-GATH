"""A-04: concurrencia real de Django (conexiones reutilizadas y gunicorn)."""
from pathlib import Path

from django.conf import settings


def test_conexiones_reutilizadas_por_defecto():
    base = settings.DATABASES['default']
    assert base['CONN_MAX_AGE'] == 60
    assert base['CONN_HEALTH_CHECKS'] is True


def test_contenedor_arranca_con_gunicorn_no_con_runserver():
    contenido = (Path(settings.BASE_DIR) / 'django.dockerfile').read_text(encoding='utf-8')
    assert 'gunicorn GATH.wsgi:application' in contenido
    assert 'manage.py", "runserver' not in contenido
    # Workers e hilos configurables por entorno con los valores pedidos.
    assert 'GUNICORN_WORKERS' in contenido
    assert 'GUNICORN_THREADS' in contenido
    assert 'GUNICORN_TIMEOUT' in contenido
