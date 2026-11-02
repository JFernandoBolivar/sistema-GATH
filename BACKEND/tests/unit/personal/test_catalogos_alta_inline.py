"""
Tests unitarios (sin BD) del alta inline de catálogos académicos del
expediente (opción "Otra X" del registro de trabajador): casos de uso con
repositorio en memoria y vistas con el repositorio ORM reemplazado.
"""
import pytest
from rest_framework.test import APIRequestFactory

from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from apps.personal.application.use_cases.gestionar_catalogos_soporte import (
    crear_capacitacion,
    crear_carrera,
    crear_institucion,
    crear_mencion,
)
from apps.personal.domain.entities.catalogos_soporte import Capacitacion, Carrera, Institucion, Mencion
from apps.personal.presentation.views import catalogos_soporte_views as vistas


class RepoAltaInlineMemoria:
    """Repositorio en memoria con las mismas reglas que el ORM: padre existente y nombre único (sin distinguir mayúsculas)."""

    def __init__(self):
        self.niveles = {1, 3}
        self.carreras: list[Carrera] = [Carrera(id=1, nombre="Ingeniería Electrónica", nivel_academico_id=3)]
        self.menciones: list[Mencion] = [Mencion(id=1, nombre="Telecomunicaciones", carrera_id=1)]
        self.instituciones: list[Institucion] = [Institucion(id=1, nombre="UCV")]
        self.capacitaciones: list[Capacitacion] = [Capacitacion(id=1, nombre="Excel Avanzado")]

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

    def crear_mencion(self, nombre, carrera_id):
        if not any(c.id == carrera_id for c in self.carreras):
            raise NotFoundError("Carrera no existe.")
        if self._duplicado(self.menciones, nombre, carrera_id=carrera_id):
            raise ConflictError("La mención ya existe.")
        nueva = Mencion(id=len(self.menciones) + 1, nombre=nombre, carrera_id=carrera_id)
        self.menciones.append(nueva)
        return nueva

    def crear_institucion(self, nombre):
        if self._duplicado(self.instituciones, nombre):
            raise ConflictError("La institución ya existe.")
        nueva = Institucion(id=len(self.instituciones) + 1, nombre=nombre)
        self.instituciones.append(nueva)
        return nueva

    def crear_capacitacion(self, nombre):
        if self._duplicado(self.capacitaciones, nombre):
            raise ConflictError("La capacitación ya existe.")
        nueva = Capacitacion(id=len(self.capacitaciones) + 1, nombre=nombre)
        self.capacitaciones.append(nueva)
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


# ----------------------------------------------------------------------
# Mención
# ----------------------------------------------------------------------

def test_crear_mencion_asocia_la_carrera(repo):
    mencion = crear_mencion(repo, " Control ", 1)

    assert mencion == Mencion(id=2, nombre="Control", carrera_id=1)


def test_crear_mencion_exige_carrera_existente(repo):
    with pytest.raises(ValidationError):
        crear_mencion(repo, "Control", 0)
    with pytest.raises(NotFoundError):
        crear_mencion(repo, "Control", 99)


def test_crear_mencion_duplicado_es_por_carrera(repo):
    repo.carreras.append(Carrera(id=2, nombre="Ingeniería Eléctrica", nivel_academico_id=3))

    with pytest.raises(ConflictError):
        crear_mencion(repo, "telecomunicaciones", 1)
    assert crear_mencion(repo, "Telecomunicaciones", 2).carrera_id == 2


def test_vista_crear_mencion_responde_201(monkeypatch, repo):
    monkeypatch.setattr(vistas, "RepoCatalogosSoporteORM", lambda: repo)

    response = _post(vistas.MencionesListView, "/api/v1/personal/catalogos/menciones/", {"nombre": "Control", "carrera_id": 1})

    assert response.status_code == 201
    assert response.data["data"] == {"id": 2, "nombre": "Control", "carrera_id": 1}


# ----------------------------------------------------------------------
# Institución
# ----------------------------------------------------------------------

def test_crear_institucion(repo):
    assert crear_institucion(repo, "  UNEXPO ") == Institucion(id=2, nombre="UNEXPO")


def test_crear_institucion_rechaza_vacio_y_duplicado(repo):
    with pytest.raises(ValidationError):
        crear_institucion(repo, "  ")
    with pytest.raises(ConflictError):
        crear_institucion(repo, "ucv")


def test_vista_crear_institucion_responde_201(monkeypatch, repo):
    monkeypatch.setattr(vistas, "RepoCatalogosSoporteORM", lambda: repo)

    response = _post(vistas.InstitucionesListView, "/api/v1/personal/catalogos/instituciones/", {"nombre": "UNEXPO"})

    assert response.status_code == 201
    assert response.data["data"] == {"id": 2, "nombre": "UNEXPO"}


# ----------------------------------------------------------------------
# Capacitación
# ----------------------------------------------------------------------

def test_crear_capacitacion(repo):
    assert crear_capacitacion(repo, " Oratoria ") == Capacitacion(id=2, nombre="Oratoria")


def test_crear_capacitacion_rechaza_vacio_y_duplicado(repo):
    with pytest.raises(ValidationError):
        crear_capacitacion(repo, "")
    with pytest.raises(ConflictError):
        crear_capacitacion(repo, "EXCEL AVANZADO")


def test_vista_crear_capacitacion_responde_201(monkeypatch, repo):
    monkeypatch.setattr(vistas, "RepoCatalogosSoporteORM", lambda: repo)

    response = _post(vistas.CapacitacionesListView, "/api/v1/personal/catalogos/capacitaciones/", {"nombre": "Oratoria"})

    assert response.status_code == 201
    assert response.data["data"] == {"id": 2, "nombre": "Oratoria"}
