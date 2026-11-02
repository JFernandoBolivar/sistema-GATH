"""
Contrato de la cola de tareas real (Etapa A1): `CeleryTaskQueue` sobre la app
`GATH.celery`, con broker disponible (memory://) y no disponible, y la tarea
`core.ping`. Ninguna prueba depende de simular un task_id.
"""
import pytest
from celery import Celery

from core.domain.exceptions import ColaTareasNoDisponible
from core.infrastructure.tasks import CeleryTaskQueue
from core.infrastructure.tasks.ping_tasks import ping


@pytest.fixture(autouse=True)
def _sin_broker_del_entorno(monkeypatch):
    # Celery da prioridad a la variable CELERY_BROKER_URL sobre el broker del
    # constructor: dentro del contenedor apunta al RabbitMQ real y las pruebas
    # dejarían de usar el broker que declaran.
    monkeypatch.delenv('CELERY_BROKER_URL', raising=False)


def _app(broker):
    app = Celery('prueba', broker=broker)
    app.conf.broker_connection_retry_on_startup = False
    app.conf.task_publish_retry_policy = {'max_retries': 0}
    return app


def test_encolar_con_broker_disponible_devuelve_task_id_real():
    task_id = CeleryTaskQueue(celery_app=_app('memory://')).encolar('core.ping', origen='test')
    assert isinstance(task_id, str) and len(task_id) >= 32


def test_encolar_con_broker_inalcanzable_falla_cerrado():
    # Puerto cerrado en localhost: la conexión se rechaza de inmediato.
    app = _app('amqp://x:y@127.0.0.1:1/gath')
    with pytest.raises(ColaTareasNoDisponible):
        CeleryTaskQueue(celery_app=app).encolar('core.ping')


def test_encolar_sin_broker_configurado_falla_cerrado(settings):
    settings.CELERY_BROKER_URL = ''
    with pytest.raises(ColaTareasNoDisponible):
        CeleryTaskQueue().encolar('core.ping')


def test_app_real_de_gath_esta_configurada_y_registra_ping():
    from GATH.celery import app

    assert app.conf.task_default_queue == 'gath'
    assert app.conf.task_acks_late is True
    app.loader.import_default_modules()
    assert 'core.ping' in app.tasks


def test_tarea_ping_responde_pong():
    assert ping.run('worker') == 'pong:worker'
    resultado = ping.apply(args=('eager',))
    assert resultado.get() == 'pong:eager'
