"""
Tests unitarios de los adaptadores de infraestructura transversal (FileStorage y TaskQueue).

`SeaweedFSStorage` corrige CRIT-01 de AUDITORIA_CALIDAD_BACKEND_2026-09-15.md:
antes fallaba en silencio (cliente S3 no disponible) devolviendo valores que
aparentaban éxito sin persistir nada. Estos tests confirman que ahora falla
cerrado (D-11): siempre lanza `AlmacenamientoNoDisponible`, nunca finge éxito.
"""
import sys
from unittest.mock import MagicMock, patch

import pytest

from core.domain.exceptions import AlmacenamientoNoDisponible, ColaTareasNoDisponible
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.tasks.celery_queue import CeleryTaskQueue


def test_seaweedfs_storage_falla_cerrado_si_boto3_no_esta_instalado():
    """Simula boto3 ausente (ImportError): antes devolvía la clave como si se
    hubiera guardado; ahora debe lanzar AlmacenamientoNoDisponible."""
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333")
    with patch.dict(sys.modules, {"boto3": None}):
        with pytest.raises(AlmacenamientoNoDisponible):
            storage.subir("documentos/cedula.pdf", b"%PDF-1.4...", "application/pdf")


def test_seaweedfs_storage_falla_cerrado_si_el_servidor_s3_es_inalcanzable():
    """Con boto3 instalado pero sin un SeaweedFS real detrás del endpoint,
    subir/descargar (ambas hacen una llamada de red real) deben fallar
    cerrado, nunca devolver datos falsos como antes de CRIT-01."""
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333")

    with pytest.raises(AlmacenamientoNoDisponible):
        storage.subir("documentos/cedula.pdf", b"%PDF-1.4...", "application/pdf")

    with pytest.raises(AlmacenamientoNoDisponible):
        storage.descargar("documentos/cedula.pdf")


def test_seaweedfs_storage_sube_correctamente_cuando_el_cliente_s3_funciona():
    """Camino feliz: con un cliente S3 que responde, subir() persiste de verdad
    (vía put_object) y retorna la clave — sin excepciones."""
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333")
    cliente_falso = MagicMock()
    storage._s3_client = cliente_falso

    clave = storage.subir("documentos/cedula.pdf", b"%PDF-1.4...", "application/pdf")

    assert clave == "documentos/cedula.pdf"
    cliente_falso.put_object.assert_called_once()
    assert cliente_falso.put_object.call_args.kwargs["Key"] == "documentos/cedula.pdf"


def test_seaweedfs_storage_elimina_el_objeto_con_delete_object():
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333", bucket_name="gath-test")
    cliente_falso = MagicMock()
    storage._s3_client = cliente_falso

    assert storage.eliminar("autogestion/soportes/1/a.pdf") is None

    cliente_falso.delete_object.assert_called_once_with(Bucket="gath-test", Key="autogestion/soportes/1/a.pdf")


def test_seaweedfs_storage_eliminar_falla_cerrado_si_el_cliente_falla():
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333")
    cliente_falso = MagicMock()
    cliente_falso.delete_object.side_effect = RuntimeError("s3 caído")
    storage._s3_client = cliente_falso

    with pytest.raises(AlmacenamientoNoDisponible):
        storage.eliminar("autogestion/soportes/1/a.pdf")


def test_seaweedfs_storage_existe_distingue_objeto_ausente_de_almacen_caido():
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333", bucket_name="gath-test")
    cliente_falso = MagicMock()
    storage._s3_client = cliente_falso

    assert storage.existe("biblioteca/logo.png") is True

    ausente = RuntimeError("Not Found")
    ausente.response = {"Error": {"Code": "NoSuchKey"}}
    cliente_falso.head_object.side_effect = ausente
    assert storage.existe("biblioteca/logo.png") is False

    caido = RuntimeError("conexión rechazada")
    caido.response = {}
    cliente_falso.head_object.side_effect = caido
    with pytest.raises(AlmacenamientoNoDisponible):
        storage.existe("biblioteca/logo.png")


def test_celery_task_queue_sin_app_falla_explicito_en_vez_de_simular_exito():
    """Antes devolvía "simulated-task-..." aparentando que la tarea se encoló."""
    queue = CeleryTaskQueue()
    with patch.dict(sys.modules, {"GATH.celery": None}):
        with pytest.raises(ColaTareasNoDisponible):
            queue.encolar("gath.generar_carnet_pdf", carnet_id=123)


def test_celery_task_queue_encola_con_la_app_inyectada():
    app = MagicMock()
    app.send_task.return_value.id = "abc-123"
    assert CeleryTaskQueue(celery_app=app).encolar("gath.tarea", x=1) == "abc-123"
    args, kwargs = app.send_task.call_args
    assert args == ("gath.tarea",)
    assert kwargs["kwargs"] == {"x": 1}
    assert kwargs["headers"]["trace_id"]


def test_celery_task_queue_traduce_fallo_del_broker():
    app = MagicMock()
    app.send_task.side_effect = ConnectionError("broker caído")
    with pytest.raises(ColaTareasNoDisponible):
        CeleryTaskQueue(celery_app=app).encolar("gath.tarea")


def test_h12_el_cliente_s3_tiene_tiempos_acotados_y_una_copia_rapida():
    """H-12: sin tiempos, boto3 espera 60 s y reintenta; con el almacén caído colgaba la emisión."""
    import time

    from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

    almacen = SeaweedFSStorage(endpoint_url='http://10.255.255.1:8333', access_key='a', secret_key='b')
    rapido = almacen.con_tiempos(connect_timeout=1, read_timeout=1, max_attempts=1)
    config = rapido._get_client().meta.config
    assert (config.connect_timeout, config.read_timeout) == (1, 1)
    assert almacen._get_client().meta.config.connect_timeout == 3

    inicio = time.monotonic()
    try:
        rapido.subir('x/y.pdf', b'%PDF', 'application/pdf')
    except Exception:  # noqa: BLE001 - se espera que falle: el destino no responde
        pass
    assert time.monotonic() - inicio < 6
