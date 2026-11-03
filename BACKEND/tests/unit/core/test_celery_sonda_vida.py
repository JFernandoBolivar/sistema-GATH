"""La sonda de vida del worker reemplaza a `celery inspect ping` en el healthcheck."""
from pathlib import Path
from unittest.mock import MagicMock

import GATH.celery as celery_mod


def test_sonda_registrada_en_el_worker():
    assert celery_mod.SondaVidaWorker in celery_mod.app.steps['worker']


def test_latido_toca_el_archivo_y_stop_lo_borra(tmp_path, monkeypatch):
    archivo = tmp_path / 'latido'
    monkeypatch.setattr(celery_mod, 'HEARTBEAT_FILE', archivo)
    worker = MagicMock()
    sonda = celery_mod.SondaVidaWorker.__new__(celery_mod.SondaVidaWorker)
    sonda.tref = None

    sonda.start(worker)
    assert archivo.exists()
    worker.timer.call_repeatedly.assert_called_once()
    intervalo = worker.timer.call_repeatedly.call_args.args[0]
    assert intervalo < 60  # el healthcheck exige un latido de menos de 60 s

    sonda.stop(worker)
    assert not archivo.exists()
    sonda.tref.cancel.assert_called_once()


def test_healthcheck_de_compose_no_usa_inspect_ping():
    compose = (Path(__file__).resolve().parents[4] / 'compose.yml')
    if not compose.exists():  # dentro de la imagen no está compose.yml
        return
    texto = compose.read_text(encoding='utf-8')
    assert 'inspect ping' not in texto
    assert '/tmp/celery_worker_heartbeat' in texto
