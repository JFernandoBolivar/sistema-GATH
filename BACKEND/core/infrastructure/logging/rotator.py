"""
Rotación con compresión gzip para los archivos de auditoría TXT (B1.12, §I.4.7).

En la biblioteca estándar de Python (logging.handlers):
- `namer` es una función (name: str) -> str que calcula el nombre final del archivo rotado.
- `rotator` es una función (source: str, dest: str) -> None que realiza la compresión y eliminación.
"""

import gzip
import os
import shutil


def gzip_namer(default_name: str) -> str:
    """Devuelve la ruta del archivo rotado con extensión .gz."""
    return f"{default_name}.gz"


def gzip_rotator(source: str, dest: str) -> None:
    """Comprime en gzip el archivo origen y elimina el archivo sin comprimir."""
    if not os.path.exists(source):
        return
    with open(source, "rb") as origen, gzip.open(dest, "wb") as destino:
        shutil.copyfileobj(origen, destino)
    try:
        os.remove(source)
    except OSError:
        pass


# Retrocompatibilidad
rotar_gzip = gzip_namer
