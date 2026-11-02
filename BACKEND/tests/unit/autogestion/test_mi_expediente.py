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


class RepoPortalMemoria:
    """Doble en memoria del puerto `RepoPortalTrabajador`."""

    def __init__(self, empleados=None, familiares=None, carnets=None, previo=False, pdf=None):
        self.empleados = empleados or {}
        self.familiares = familiares or {}
        self.carnets = carnets or {}
        self.previo = previo
        self.pdf = pdf
        self.emitidos = []

    def obtener_empleado(self, cedula):
        return self.empleados.get(cedula)

    def listar_familiares(self, cedula):
        return self.familiares.get(cedula, [])

    def listar_carnets(self, cedula):
        return self.carnets.get(cedula, [])

    def listar_motivos_carnet(self):
        return [{"id": 1, "nombre": "PRIMERA VEZ", "descripcion": "PRIMERA VEZ"}]

    def tiene_carnet_previo(self, cedula):
        return self.previo

    def emitir_carnet(self, cedula, motivo_id, observaciones):
        self.emitidos.append((cedula, motivo_id, observaciones))
        return MagicMock(id=99)

    def obtener_datos_complementarios(self, cedula):
        return None

    def generar_pdf_carnet_activo(self, cedula):
        return self.pdf


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

    repo = RepoPortalMemoria(
        empleados={"V-12345678": mock_emp}, familiares={"V-12345678": [mock_fam]},
    )

    resultado = obtener_mi_expediente(repo, "V-12345678")

    assert isinstance(resultado, MiExpedienteDTO)
    assert resultado.empleado.cedula == "V-12345678"
    assert len(resultado.familiares) == 1
    assert resultado.familiares[0].primer_nombre == "Ana"
    assert resultado.motivos_carnet[0]["id"] == 1
    assert resultado.carnet_activo is None


def test_obtener_mi_expediente_cedula_vacia():
    with pytest.raises(NotFoundError) as exc:
        obtener_mi_expediente(RepoPortalMemoria(), "   ")
    assert "obligatoria" in str(exc.value)


def test_obtener_mi_expediente_empleado_inexistente():
    with pytest.raises(NotFoundError) as exc:
        obtener_mi_expediente(RepoPortalMemoria(), "V-99999999")
    assert "No se encontró el expediente" in str(exc.value)


def test_vista_mi_expediente_requiere_autenticacion():
    from rest_framework.test import APIRequestFactory
    from apps.autogestion.presentation.views.autogestion_views import MiExpedienteView

    factory = APIRequestFactory()
    view = MiExpedienteView.as_view()

    request = factory.get("/api/v1/autogestion/mi-expediente/")
    response = view(request)
    assert response.status_code == 401


@patch("apps.autogestion.presentation.views.autogestion_views.serializar_mi_expediente")
@patch("apps.autogestion.presentation.views.autogestion_views.obtener_mi_expediente")
def test_vista_mi_expediente_usuario_autenticado_retorna_200(mock_uc, mock_serializar):
    from rest_framework.test import APIRequestFactory, force_authenticate
    from apps.autogestion.presentation.views.autogestion_views import MiExpedienteView

    mock_serializar.return_value = {"empleado": {"cedula": "V-12345678", "nombres": "Juan"}}

    user = MagicMock()
    user.pk = 1
    user.is_authenticated = True
    user.cedula_id = "V-12345678"

    request = APIRequestFactory().get("/api/v1/autogestion/mi-expediente/")
    force_authenticate(request, user=user)
    response = MiExpedienteView.as_view()(request)

    assert response.status_code == 200
    assert response.data["status"] == "success"
    assert response.data["data"]["empleado"]["cedula"] == "V-12345678"
    assert mock_uc.call_args.args[1] == "V-12345678"


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


def test_solicitar_mi_carnet_sin_motivo_es_primera_emision_si_no_hay_previo():
    from apps.autogestion.application.use_cases.obtener_mi_expediente import solicitar_mi_carnet

    repo = RepoPortalMemoria(previo=False)
    solicitar_mi_carnet(repo, "V-1")
    assert repo.emitidos[0][:2] == ("V-1", 1)
    assert "Autogestión" in repo.emitidos[0][2]


def test_solicitar_mi_carnet_sin_motivo_es_reposicion_si_hay_previo():
    from apps.autogestion.application.use_cases.obtener_mi_expediente import solicitar_mi_carnet

    repo = RepoPortalMemoria(previo=True)
    solicitar_mi_carnet(repo, "V-1")
    assert repo.emitidos[0][:2] == ("V-1", 2)


def test_solicitar_mi_carnet_motivo_no_numerico_es_error_de_validacion_no_500():
    from apps.autogestion.application.use_cases.obtener_mi_expediente import solicitar_mi_carnet
    from core.domain.exceptions import ValidationError

    with pytest.raises(ValidationError):
        solicitar_mi_carnet(RepoPortalMemoria(), "V-1", motivo_id="abc")


def test_obtener_mi_carnet_pdf_sin_carnet_activo_lanza_not_found():
    from apps.autogestion.application.use_cases.obtener_mi_expediente import obtener_mi_carnet_pdf

    with pytest.raises(NotFoundError):
        obtener_mi_carnet_pdf(RepoPortalMemoria(pdf=None), "V-1")
    assert obtener_mi_carnet_pdf(RepoPortalMemoria(pdf=b"%PDF"), "V-1") == b"%PDF"
