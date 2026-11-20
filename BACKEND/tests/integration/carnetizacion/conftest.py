"""Configuración común de las pruebas de integración de carnetización."""
import pytest

from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage


@pytest.fixture(autouse=True)
def almacen_no_disponible_rapido(monkeypatch):
    """SeaweedFS no es alcanzable desde las pruebas: que falle al instante en vez de esperar los
    reintentos de red (la emisión guarda el PDF emitido, B-4, y tolera que el almacén falle).
    Las pruebas que necesitan un almacén inyectan el suyo."""

    def no_disponible(self, *args, **kwargs):
        raise ConnectionError('Almacén no disponible en pruebas')

    monkeypatch.setattr(SeaweedFSStorage, 'subir', no_disponible)
