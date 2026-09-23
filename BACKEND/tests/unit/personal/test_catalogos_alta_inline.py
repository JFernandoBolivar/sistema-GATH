"""
Tests unitarios (sin BD) del alta inline de catálogos académicos del
expediente (opción "Otra X" del registro de trabajador): casos de uso con
repositorio en memoria y vistas con el repositorio ORM reemplazado.
"""
import pytest
from rest_framework.test import APIRequestFactory

from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from apps.personal.application.use_cases.gestionar_catalogos_soporte import crear_carrera
from apps.personal.domain.entities.catalogos_soporte import Carrera
from apps.personal.presentation.views import catalogos_soporte_views as vistas


class RepoAltaInlineMemoria:
    """Repositorio en memoria con las mismas reglas que el ORM: padre existente y nombre único (sin distinguir mayúsculas)."""

    def __init__(self):
        self.niveles = {1, 3}
        self.carreras: list[Carrera] = [Carrera(id=1, nombre="Ingeniería Electrónica", nivel_academico_id=3)]

    @staticmethod
    def _duplicado(items, nombre, **filtro):
        return any(
            i.nombre.lower() == nombre.lower() and all(getattr(i, k) == v for k, v in filtro.items())
            for i in items
        )

    def crear_carrera(self, nombre, nivel_academico_id):
        if nivel_academico_id not in self.niveles:
            raise NotFoundError("Nivel académico no existe.")
        if self._duplicado(self.carreras, nombre):
            raise ConflictError("La carrera ya existe.")
        nueva = Carrera(id=len(self.carreras) + 1, nombre=nombre, nivel_academico_id=nivel_academico_id)
        self.carreras.append(nueva)
        return nueva


@pytest.fixture
def repo():
    return RepoAltaInlineMemoria()


def _post(view_cls, url, data):
    request = APIRequestFactory().post(url, data, format="json")
    view = view_cls()
    return view.post(view.initialize_request(request))


# ----------------------------------------------------------------------
# Carrera
# ----------------------------------------------------------------------

def test_crear_carrera_limpia_nombre_y_asocia_nivel(repo):
    carrera = crear_carrera(repo, "  Ingeniería de Sistemas  ", 3)

    assert carrera.nombre == "Ingeniería de Sistemas"
    assert carrera.nivel_academico_id == 3
    assert carrera in repo.carreras


@pytest.mark.parametrize("nombre", ["", "   ", "x" * 201])
def test_crear_carrera_rechaza_nombre_invalido(repo, nombre):
    with pytest.raises(ValidationError):
        crear_carrera(repo, nombre, 3)


def test_crear_carrera_rechaza_nivel_invalido(repo):
    with pytest.raises(ValidationError):
        crear_carrera(repo, "Medicina", 0)
    with pytest.raises(NotFoundError):
        crear_carrera(repo, "Medicina", 99)


def test_crear_carrera_rechaza_duplicado_sin_distinguir_mayusculas(repo):
    with pytest.raises(ConflictError):
        crear_carrera(repo, "INGENIERÍA ELECTRÓNICA", 3)


def test_vista_crear_carrera_responde_201_con_el_registro(monkeypatch, repo):
    monkeypatch.setattr(vistas, "RepoCatalogosSoporteORM", lambda: repo)

    response = _post(vistas.CarrerasListView, "/api/v1/personal/catalogos/carreras/", {"nombre": "Medicina", "nivel_academico_id": 1})

    assert response.status_code == 201
    assert response.data["data"] == {"id": 2, "nombre": "Medicina", "nivel_academico_id": 1}


def test_vista_crear_carrera_exige_nivel_academico(monkeypatch, repo):
    from rest_framework.exceptions import ValidationError as DRFValidationError

    monkeypatch.setattr(vistas, "RepoCatalogosSoporteORM", lambda: repo)
    with pytest.raises(DRFValidationError):
        _post(vistas.CarrerasListView, "/api/v1/personal/catalogos/carreras/", {"nombre": "Medicina"})
