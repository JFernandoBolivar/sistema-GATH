"""La URL de imagen de plantilla es una ruta autenticada, nunca /media/ directo."""
from types import SimpleNamespace

from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import plantilla_a_entidad


def _modelo(imagen):
    return SimpleNamespace(pk=7, nombre='P', imagen=imagen, activo=True, creado='2026-01-01')


def test_imagen_url_apunta_a_la_ruta_autenticada():
    imagen = SimpleNamespace(url='/media/plantillas/x.png')
    entidad = plantilla_a_entidad(_modelo(imagen))
    assert entidad.imagen_url == '/api/v1/carnetizacion/plantillas/7/imagen/'


def test_sin_imagen_url_vacia():
    assert plantilla_a_entidad(_modelo(None)).imagen_url == ''
