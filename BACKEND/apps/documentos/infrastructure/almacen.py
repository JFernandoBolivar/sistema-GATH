"""Almacén de archivos de documentos (SeaweedFS). Las pruebas lo sustituyen por uno en memoria."""
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage


def obtener_almacen():
    return SeaweedFSStorage()
