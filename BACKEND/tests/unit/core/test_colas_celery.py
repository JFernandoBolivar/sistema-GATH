"""H-6: colas de Celery separadas (mail, docs, maint) detrás de un flag."""
from django.conf import settings

COLAS_CONOCIDAS = {'mail', 'docs', 'maint', 'gath'}


def _tareas_registradas():
    from GATH.celery import app

    app.loader.import_default_modules()
    app.autodiscover_tasks(
        lambda: [a for a in settings.INSTALLED_APPS if a == 'core' or a.startswith('apps.')],
        related_name='infrastructure.tasks',
        force=True,
    )
    return {n for n in app.tasks if not n.startswith('celery.')}


def test_cada_tarea_registrada_tiene_ruta_conocida():
    registradas = _tareas_registradas()
    assert registradas, 'no se descubrió ninguna tarea'
    sin_ruta = registradas - set(settings.CELERY_RUTAS_POR_COLA)
    assert not sin_ruta, f'tareas sin clasificar en CELERY_RUTAS_POR_COLA: {sorted(sin_ruta)}'
    for nombre, ruta in settings.CELERY_RUTAS_POR_COLA.items():
        assert ruta['queue'] in COLAS_CONOCIDAS, nombre


def test_no_hay_rutas_fantasma():
    assert set(settings.CELERY_RUTAS_POR_COLA) <= _tareas_registradas()


def test_las_tareas_programadas_estan_clasificadas():
    for entrada in settings.CELERY_BEAT_SCHEDULE.values():
        assert entrada['task'] in settings.CELERY_RUTAS_POR_COLA


def test_el_flag_gobierna_las_rutas_activas():
    if settings.CELERY_COLAS_SEPARADAS:
        assert settings.CELERY_TASK_ROUTES == settings.CELERY_RUTAS_POR_COLA
    else:
        assert settings.CELERY_TASK_ROUTES == {}


def test_flag_activo_aplica_rutas_y_sin_flag_no_hay_ninguna():
    """Evalúa settings en un proceso aparte con y sin la variable de entorno."""
    import json
    import os
    import subprocess
    import sys

    codigo = (
        'import json,django;'
        'from django.conf import settings;'
        'print(json.dumps(settings.CELERY_TASK_ROUTES))'
    )

    def rutas(valor):
        env = {**os.environ, 'DJANGO_SETTINGS_MODULE': 'GATH.settings'}
        env.pop('CELERY_COLAS_SEPARADAS', None)
        if valor is not None:
            env['CELERY_COLAS_SEPARADAS'] = valor
        r = subprocess.run([sys.executable, '-c', codigo], env=env, capture_output=True, text=True,
                           cwd=str(settings.BASE_DIR), check=True)
        return json.loads(r.stdout.strip().splitlines()[-1])

    assert rutas(None) == {}
    assert rutas('0') == {}
    activas = rutas('1')
    assert activas['notificaciones.enviar_correo_outbox'] == {'queue': 'mail'}
    assert activas['exportaciones.generar'] == {'queue': 'docs'}
    assert activas['exportaciones.purgar'] == {'queue': 'maint'}
