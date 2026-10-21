"""
Tests unitarios del caso de uso y vista de Mi Expediente (Autogestión).
Arquitectura Onion pura sin acceso a base de datos.
"""
from unittest.mock import MagicMock, patch
import pytest
from core.domain.exceptions import NotFoundError
from apps.autogestion.application.use_cases.obtener_mi_expediente import (
    obtener_mi_expediente,
    MiExpedienteDTO,
)


class RepoPersonalMemoria:
    def __init__(self, empleados=None):
        self.empleados = empleados or {}

    def obtener_por_cedula(self, cedula):
        return self.empleados.get(cedula)


class RepoFamiliaresMemoria:
    def __init__(self, familiares_por_empleado=None):
        self.familiares_por_empleado = familiares_por_empleado or {}

    def listar_por_empleado(self, empleado_cedula):
        return self.familiares_por_empleado.get(empleado_cedula, [])


def test_obtener_mi_expediente_exitoso():
    mock_emp = MagicMock()
    mock_emp.id = 1
    mock_emp.cedula = "V-12345678"
    mock_emp.nombres = "Juan"
    mock_emp.apellidos = "Pérez"
    mock_emp.nombre_completo = "Juan Pérez"

    mock_fam = MagicMock()
    mock_fam.id = 10
    mock_fam.empleado_cedula = "V-12345678"
    mock_fam.primer_nombre = "Ana"
    mock_fam.segundo_nombre = None
    mock_fam.primer_apellido = "Pérez"
    mock_fam.segundo_apellido = None
    mock_fam.cedula_familiar = "V-87654321"
    mock_fam.parentesco_id = 1
    mock_fam.parentesco_nombre = "HIJO (A)"
    mock_fam.fecha_nacimiento = "2015-05-20"
    mock_fam.sexo_id = 2
    mock_fam.sexo_nombre = "FEMENINO"
    mock_fam.mismo_ente = False
    mock_fam.heredero = True
    mock_fam.observaciones = None
    mock_fam.perfil_salud = None
    mock_fam.perfil_fisico = None
    mock_fam.formacion_academica = None

    repo_pers = RepoPersonalMemoria({"V-12345678": mock_emp})
    repo_fams = RepoFamiliaresMemoria({"V-12345678": [mock_fam]})

    resultado = obtener_mi_expediente(repo_pers, repo_fams, "V-12345678")

    assert isinstance(resultado, MiExpedienteDTO)
    assert resultado.empleado.cedula == "V-12345678"
    assert len(resultado.familiares) == 1
    assert resultado.familiares[0].primer_nombre == "Ana"


def test_obtener_mi_expediente_cedula_vacia():
    repo_pers = RepoPersonalMemoria()
    repo_fams = RepoFamiliaresMemoria()

    with pytest.raises(NotFoundError) as exc:
        obtener_mi_expediente(repo_pers, repo_fams, "   ")
    assert "obligatoria" in str(exc.value)


def test_obtener_mi_expediente_empleado_inexistente():
    repo_pers = RepoPersonalMemoria()
    repo_fams = RepoFamiliaresMemoria()

    with pytest.raises(NotFoundError) as exc:
        obtener_mi_expediente(repo_pers, repo_fams, "V-99999999")
    assert "No se encontró el expediente" in str(exc.value)


def test_vista_mi_expediente_requiere_autenticacion():
    from rest_framework.test import APIRequestFactory
    from apps.autogestion.presentation.views.autogestion_views import MiExpedienteView

    factory = APIRequestFactory()
    view = MiExpedienteView.as_view()

    request = factory.get("/api/v1/autogestion/mi-expediente/")
    response = view(request)
    assert response.status_code == 401


@patch("apps.autogestion.application.use_cases.obtener_mi_expediente.obtener_mi_expediente")
def test_vista_mi_expediente_usuario_autenticado_retorna_200(mock_uc):
    from rest_framework.test import APIRequestFactory, force_authenticate
    from apps.autogestion.presentation.views.autogestion_views import MiExpedienteView

    mock_dto = MagicMock()
    mock_dto.empleado = MagicMock()
    mock_dto.familiares = []
    mock_uc.return_value = mock_dto

    user = MagicMock()
    user.pk = 1
    user.is_authenticated = True
    user.cedula_id = "V-12345678"

    factory = APIRequestFactory()
    view = MiExpedienteView.as_view()

    request = factory.get("/api/v1/autogestion/mi-expediente/")
    force_authenticate(request, user=user)

    with patch("apps.personal.presentation.serializers.personal_serializers.EmpleadoSerializer") as mock_emp_ser:
        mock_emp_ser.return_value.data = {"cedula": "V-12345678", "nombres": "Juan"}
        response = view(request)

    assert response.status_code == 200
    assert response.data["status"] == "success"
    assert response.data["data"]["empleado"]["cedula"] == "V-12345678"


def test_vista_mi_expediente_usuario_sin_cedula_retorna_404():
    from rest_framework.test import APIRequestFactory, force_authenticate
    from apps.autogestion.presentation.views.autogestion_views import MiExpedienteView

    user = MagicMock()
    user.pk = 1
    user.is_authenticated = True
    user.cedula_id = None

    factory = APIRequestFactory()
    view = MiExpedienteView.as_view()

    request = factory.get("/api/v1/autogestion/mi-expediente/")
    force_authenticate(request, user=user)

    response = view(request)
    assert response.status_code == 404
    assert response.data["status"] == "error"
