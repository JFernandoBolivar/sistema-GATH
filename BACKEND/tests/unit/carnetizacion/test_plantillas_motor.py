import pytest
from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_trabajador,
    plantilla_defecto_pasivo,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM


@pytest.mark.django_db
def test_catalogo_tipos_credencial_trabajador_y_pasivo():
    repo = RepoCarnetizacionORM()
    tipos = repo.listar_tipos_credencial()
    codigos = [t.codigo for t in tipos]
    assert "trabajador" in codigos
    assert "pasivo" in codigos


def test_plantillas_defecto_generadas_con_dimensiones_mm():
    t = plantilla_defecto_trabajador()
    assert t["dimensiones"]["ancho_mm"] == 54.0
    assert t["dimensiones"]["alto_mm"] == 85.6
    assert t["orientacion"] == "vertical"
    assert len(t["anverso"]) > 0
    assert len(t["reverso"]) > 0

    p = plantilla_defecto_pasivo()
    assert p["dimensiones"]["ancho_mm"] == 54.0
    assert p["dimensiones"]["alto_mm"] == 85.6
    assert p["orientacion"] == "vertical"
    assert len(p["anverso"]) > 0


@pytest.mark.django_db
def test_crear_borrador_y_publicar_nueva_version():
    repo = RepoCarnetizacionORM()
    borrador = repo.crear_plantilla_borrador(
        nombre="Plantilla Prueba 2026",
        codigo_tipo="trabajador",
        ancho_mm=54.0,
        alto_mm=85.6,
        orientacion="vertical",
        definicion={"caras": {"anverso": {"capas": []}}},
    )
    assert borrador.estado == "borrador"
    assert borrador.version == 1
    assert borrador.activa is False

    publicada = repo.publicar_plantilla(borrador.id, activar=True)
    assert publicada.estado == "publicada"
    assert publicada.activa is True
    assert publicada.version == 1

    # Al publicar nuevamente desde la misma raíz se genera v2
    borrador_v2 = repo.crear_plantilla_borrador(
        nombre="Plantilla Prueba 2026 v2",
        codigo_tipo="trabajador",
        ancho_mm=54.0,
        alto_mm=85.6,
        orientacion="vertical",
        definicion={"caras": {"anverso": {"capas": [{"tipo": "texto"}]}}},
        plantilla_raiz_id=borrador.plantilla_raiz_id,
    )
    publicada_v2 = repo.publicar_plantilla(borrador_v2.id, activar=True)
    assert publicada_v2.version == 2
    assert publicada_v2.activa is True

    # La versión previa queda inactiva
    previa = repo.obtener_plantilla(borrador.id)
    assert previa.activa is False

    # Reactivar versión 1
    reactivada = repo.activar_plantilla(borrador.id)
    assert reactivada.activa is True
    assert reactivada.version == 1
    v2_actualizada = repo.obtener_plantilla(publicada_v2.id)
    assert v2_actualizada.activa is False
