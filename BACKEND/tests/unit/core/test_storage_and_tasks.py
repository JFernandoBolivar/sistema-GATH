"""
Tests unitarios de los adaptadores de infraestructura transversal (FileStorage y TaskQueue).
"""
import pytest
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.tasks.celery_queue import CeleryTaskQueue


def test_seaweedfs_storage_mock_behavior():
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333")
    # Subida simulada
    clave = storage.subir("documentos/cedula.pdf", b"%PDF-1.4...", "application/pdf")
    assert clave == "documentos/cedula.pdf"

    # URL prefirmada
    url = storage.url_firmada("documentos/cedula.pdf", expira_segundos=600)
    assert "documentos/cedula.pdf" in url
    assert "600" in url


def test_celery_task_queue_simulated_dispatch():
    queue = CeleryTaskQueue()
    task_id = queue.encolar("gath.generar_carnet_pdf", carnet_id=123)
    assert "simulated-task-gath.generar_carnet_pdf" in task_id
