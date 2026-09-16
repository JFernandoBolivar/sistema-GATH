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

from core.domain.exceptions import AlmacenamientoNoDisponible
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


def test_seaweedfs_storage_url_firmada_falla_cerrado_si_el_cliente_falla():
    """`generate_presigned_url` es un cálculo local en boto3 (no valida que el
    endpoint exista), así que se fuerza el fallo con un cliente que lanza al
    firmar — igual debe traducirse a AlmacenamientoNoDisponible, no propagar
    la excepción cruda de botocore ni devolver la URL falsa `?signature=mock`
    que existía antes de CRIT-01."""
    storage = SeaweedFSStorage(endpoint_url="http://mock-s3:8333")
    cliente_falso = MagicMock()
    cliente_falso.generate_presigned_url.side_effect = RuntimeError("firma inválida")
    storage._s3_client = cliente_falso

    with pytest.raises(AlmacenamientoNoDisponible):
        storage.url_firmada("documentos/cedula.pdf", expira_segundos=600)


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


def test_celery_task_queue_simulated_dispatch():
    queue = CeleryTaskQueue()
    task_id = queue.encolar("gath.generar_carnet_pdf", carnet_id=123)
    assert "simulated-task-gath.generar_carnet_pdf" in task_id
