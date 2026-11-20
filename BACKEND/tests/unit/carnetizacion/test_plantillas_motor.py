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


def _borrador(repo, nombre="Ciclo de vida", raiz=None):
    return repo.crear_plantilla_borrador(
        nombre=nombre, codigo_tipo="trabajador", ancho_mm=54.0, alto_mm=85.6,
        orientacion="vertical", definicion={"anverso": [], "reverso": []},
        regla_criterio="todos", regla_valor="*", plantilla_raiz_id=raiz,
    )


@pytest.mark.django_db
def test_un_borrador_no_se_puede_activar():
    """Un borrador sigue siendo editable: activarlo pondría en producción un diseño mutable."""
    from core.domain.exceptions import ValidationError

    repo = RepoCarnetizacionORM()
    borrador = _borrador(repo)

    with pytest.raises(ValidationError, match="publicadas"):
        repo.activar_plantilla(borrador.id)
    assert repo.obtener_plantilla(borrador.id).activa is False


@pytest.mark.django_db
def test_borrar_la_raiz_no_se_lleva_sus_versiones():
    from apps.carnetizacion.infrastructure.models.carnetizacion_models import PlantillaCarnetModel
    from core.domain.exceptions import ValidationError

    repo = RepoCarnetizacionORM()
    v1 = repo.publicar_plantilla(_borrador(repo).id, activar=False)
    raiz_id = PlantillaCarnetModel.objects.get(pk=v1.id).plantilla_raiz_id or v1.id
    v2 = repo.publicar_plantilla(_borrador(repo, "v2", raiz=raiz_id).id, activar=True)

    with pytest.raises(ValidationError, match="versión"):
        repo.eliminar_plantilla(raiz_id)
    assert PlantillaCarnetModel.objects.filter(pk=v2.id, activa=True).exists()


@pytest.mark.django_db
def test_una_plantilla_con_carnets_emitidos_no_se_elimina():
    from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
        CarnetEmitidoModel,
        MotivosEmisionModel,
        PlantillaCarnetModel,
    )
    from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
    from apps.personal.infrastructure.models.personal_models import EmployeeModel
    from core.domain.exceptions import ValidationError

    repo = RepoCarnetizacionORM()
    publicada = repo.publicar_plantilla(_borrador(repo).id, activar=False)
    NacionalidadModel.objects.get_or_create(id=1, defaults={"codigo": "V", "nombre": "V"})
    sexo = SexoModel.objects.create(sexo="F")
    emp = EmployeeModel.objects.create(cedulaidentidad="7711001", nombres="A", apellidos="B", sexoid=sexo)
    motivo, _ = MotivosEmisionModel.objects.get_or_create(id=1, defaults={"nombre": "Primera"})
    CarnetEmitidoModel.objects.create(
        employee=emp, motivo=motivo, security_hash="h-7711001", activo=True,
        plantilla_id=str(publicada.id), plantilla_version=1,
    )

    with pytest.raises(ValidationError, match="emitido"):
        repo.eliminar_plantilla(publicada.id)
    assert PlantillaCarnetModel.objects.filter(pk=publicada.id).exists()


@pytest.mark.django_db
def test_un_borrador_sin_uso_si_se_puede_eliminar():
    from apps.carnetizacion.infrastructure.models.carnetizacion_models import PlantillaCarnetModel

    repo = RepoCarnetizacionORM()
    borrador = _borrador(repo)
    repo.eliminar_plantilla(borrador.id)
    assert not PlantillaCarnetModel.objects.filter(pk=borrador.id).exists()
