"""
Tests unitarios del script de rotación de logs de auditoría (D-04).
"""
import gzip
from pathlib import Path
from scripts.rotate_audit_logs import rotar_directorio_logs


def test_rotar_directorio_logs(tmp_path: Path):
    # 1. Crear archivo de log archivado (formato fecha)
    log_archivado = tmp_path / "audit_backend_20260820.txt"
    log_archivado.write_text("Registro de auditoria historico...")

    # 2. Crear archivo activo (no debe tocarse)
    log_activo = tmp_path / "audit_backend.txt"
    log_activo.write_text("Registro activo del dia...")

    # 3. Ejecutar rotación
    res = rotar_directorio_logs(tmp_path)
    assert res["comprimidos"] == 1
    assert not log_archivado.exists()
    assert (tmp_path / "audit_backend_20260820.txt.gz").exists()
    assert log_activo.exists()

    # Verificar que el contenido comprimido es legible
    with gzip.open(tmp_path / "audit_backend_20260820.txt.gz", "rt") as f:
        contenido = f.read()
    assert contenido == "Registro de auditoria historico..."
