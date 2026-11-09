"""
Configuración global de pytest para el backend de GATH (D-12).
"""
import pytest
from django.apps import apps


def pytest_sessionstart(session):
    """
    Durante los tests con base de datos, habilitamos managed=True en modelos
    legados/canónicos para que el runner de pruebas (syncdb) cree las tablas
    completas (USER_cuenta, RAC_employee, etc.) en la base de datos de prueba.
    Excluimos los modelos 'Espejo' (vistas parciales) en favor de los modelos
    canónicos completos, y deduplicamos por db_table.
    """
    import django
    django.setup()
    tablas_vistas = set()

    # Primero registramos las tablas que ya son managed=True
    for model in apps.get_models():
        if model._meta.managed:
            tablas_vistas.add(model._meta.db_table)

    # Ordenamos poniendo primero los modelos canónicos (no Espejo)
    modelos = sorted(apps.get_models(), key=lambda m: 1 if 'Espejo' in m.__name__ else 0)

    for model in modelos:
        if 'Espejo' in model.__name__:
            continue
        if not model._meta.managed:
            if model._meta.db_table in tablas_vistas:
                continue
            model._meta.managed = True
            tablas_vistas.add(model._meta.db_table)


@pytest.fixture(autouse=True)
def aislar_cache_throttling(settings):
    """D-11 / B3.14: Caché aislada en LocMemCache para evitar DatabaseCache en pruebas unitarias y de integración."""
    from django.core.cache import cache
    settings.CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'tests-throttling',
        }
    }
    cache.clear()
