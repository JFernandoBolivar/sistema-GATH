"""
Rotación con compresión gzip para los archivos de auditoría TXT (B1.12, §I.4.7).

`TimedRotatingFileHandler` acepta un parámetro `namer`: una función que recibe
la ruta por defecto del archivo rotado (ej. `logs/backend/audit_backend.txt.2026-08-23`)
y devuelve la ruta final. Esta implementación comprime el archivo rotado en gzip
antes de soltarlo, cumpliendo la política de retención de 90 días con huella de
disco mínima.

Se declara en el dict `LOGGING` de `SIGEP/settings.py` como:
    'namer': 'core.infrastructure.logging.rotator.rotar_gzip'
"""

import gzip
import os


def rotar_gzip(ruta_rotada: str) -> str:
    """Comprime en gzip el archivo rotado y devuelve la ruta del `.gz`."""
    ruta_gz = f"{ruta_rotada}.gz"
    with open(ruta_rotada, 'rb') as origen, gzip.open(ruta_gz, 'wb') as destino:
        destino.writelines(origen)
    os.remove(ruta_rotada)
    return ruta_gz
