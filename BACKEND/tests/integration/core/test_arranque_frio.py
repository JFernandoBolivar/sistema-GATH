"""Fase 1: arranque en frío y cargas pesadas diferidas.

- `GATH.wsgi`/`asgi` deben forzar el URLconf al importarse, para que con
  gunicorn `--preload` el master pague el coste una sola vez.
- La primera petición de un intérprete nuevo (URLconf ya cargado por wsgi)
  debe tardar menos de 1 s.
- pandas/openpyxl no deben importarse al cargar los módulos de Excel.
"""
import ast
import json
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]


def _ejecutar(codigo: str) -> subprocess.CompletedProcess:
    entorno = dict(os.environ)
    entorno.setdefault("DJANGO_SETTINGS_MODULE", "GATH.settings")
    entorno["PYTHONPATH"] = str(RAIZ) + os.pathsep + entorno.get("PYTHONPATH", "")
    return subprocess.run(
        [sys.executable, "-c", codigo],
        cwd=str(RAIZ),
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_wsgi_y_asgi_fuerzan_el_urlconf():
    for nombre in ("wsgi.py", "asgi.py"):
        fuente = (RAIZ / "GATH" / nombre).read_text(encoding="utf-8")
        assert "get_resolver().url_patterns" in fuente, nombre


def test_primera_peticion_de_un_interprete_nuevo_baja_de_un_segundo():
    codigo = """
import json
import time

import GATH.wsgi  # fuerza el URLconf, como --preload en el master
from django.test import Client

inicio = time.perf_counter()
respuesta = Client().get('/api/v1/health/')
ms = (time.perf_counter() - inicio) * 1000
print(json.dumps({'estado': respuesta.status_code, 'ms': round(ms)}))
"""
    proceso = _ejecutar(codigo)
    assert proceso.returncode == 0, proceso.stderr[-2000:]
    datos = json.loads(proceso.stdout.strip().splitlines()[-1])
    assert datos["estado"] == 200
    assert datos["ms"] < 1000, datos


def test_preload_no_abre_conexion_a_bd_antes_del_fork():
    """gunicorn --preload importa GATH.wsgi en el master; la BD se abre en el worker."""
    codigo = """
import json
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'GATH.settings')
import GATH.wsgi  # noqa: F401 - simula el preload del master

from django.db import connection

print(json.dumps({'sin_conexion': connection.connection is None}))
"""
    proceso = _ejecutar(codigo)
    assert proceso.returncode == 0, proceso.stderr[-2000:]
    datos = json.loads(proceso.stdout.strip().splitlines()[-1])
    assert datos["sin_conexion"] is True, datos


def _imports_de_nivel_superior(ruta: Path) -> list[str]:
    arbol = ast.parse(ruta.read_text(encoding="utf-8"))
    modulos = []
    for nodo in arbol.body:
        if isinstance(nodo, ast.Import):
            modulos.extend(alias.name for alias in nodo.names)
        elif isinstance(nodo, ast.ImportFrom) and nodo.module:
            modulos.append(nodo.module)
    return modulos


def test_los_importadores_de_excel_no_cargan_pandas_ni_openpyxl_al_importarse():
    archivos = [
        RAIZ / "apps/personal/infrastructure/importadores/carga_masiva_empleados.py",
        RAIZ / "apps/personal/infrastructure/importadores/carga_masiva_expediente.py",
        RAIZ / "apps/cargos/infrastructure/importadores/carga_masiva_cargos_especiales.py",
        RAIZ / "apps/autogestion/infrastructure/services/excel_service.py",
    ]
    for archivo in archivos:
        modulos = _imports_de_nivel_superior(archivo)
        assert "pandas" not in modulos, archivo
        assert not any(m.startswith("openpyxl") for m in modulos), archivo


def test_gunicorn_recicla_workers_y_usa_shm():
    fuente = (RAIZ / "django.dockerfile").read_text(encoding="utf-8")
    for flag in (
        "--preload",
        "--max-requests 1000",
        "--max-requests-jitter 100",
        "--worker-tmp-dir /dev/shm",
    ):
        assert flag in fuente, flag
