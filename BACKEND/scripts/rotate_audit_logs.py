"""
Script de Mantenimiento y Rotación de Logs de Auditoría (D-04, T7.5).

Reglas:
1. Comprime con gzip los archivos de auditoría diarios generados en días previos.
2. Elimina archivos comprimidos cuya antigüedad supere los 90 días (política de retención).
3. Nunca bloquea las escrituras concurrentes del log activo del día.
"""
import os
import gzip
import shutil
import time
import logging
from pathlib import Path

logger = logging.getLogger("gath.log_rotation")
RETENTION_DAYS = 90
SECONDS_IN_DAY = 86400


def rotar_directorio_logs(log_dir_path: Path, dry_run: bool = False) -> dict:
    """Procesa un directorio de logs rotando a gzip y purgando mayores a 90 días."""
    if not log_dir_path.exists():
        return {"comprimidos": 0, "eliminados": 0}

    ahora = time.time()
    limite_retencion = ahora - (RETENTION_DAYS * SECONDS_IN_DAY)
    comprimidos = 0
    eliminados = 0

    for item in log_dir_path.iterdir():
        if not item.is_file():
            continue

        # 1. Purgar archivos .gz más viejos que 90 días
        if item.name.endswith(".gz"):
            mtime = item.stat().st_mtime
            if mtime < limite_retencion:
                if not dry_run:
                    item.unlink()
                eliminados += 1
                logger.info("Log histórico eliminado (>90 días): %s", item.name)
            continue

        # 2. Comprimir archivos .txt archivados (que no sean el archivo activo)
        # Formato esperado para archivados: audit_backend_YYYYMMDD.txt
        if item.name.endswith(".txt") and ("_" in item.stem and item.stem.split("_")[-1].isdigit()):
            gz_path = item.with_suffix(".txt.gz")
            if not gz_path.exists():
                if not dry_run:
                    with open(item, "rb") as f_in:
                        with gzip.open(gz_path, "wb") as f_out:
                            shutil.copyfileobj(f_in, f_out)
                    item.unlink()
                comprimidos += 1
                logger.info("Log rotado y comprimido: %s -> %s", item.name, gz_path.name)

    return {"comprimidos": comprimidos, "eliminados": eliminados}


def main():
    base_dir = Path(__file__).resolve().parent.parent
    backend_logs = base_dir / "logs" / "backend"
    frontend_logs = base_dir.parent / "NextJS" / "logs" / "frontend"

    res_b = rotar_directorio_logs(backend_logs)
    res_f = rotar_directorio_logs(frontend_logs)
    print(f"Rotación completada. Backend: {res_b}, Frontend: {res_f}")


if __name__ == "__main__":
    main()
