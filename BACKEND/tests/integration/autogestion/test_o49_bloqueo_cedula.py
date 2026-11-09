"""O49-BLOQUEO: la cédula del trabajador es inmutable tras el registro.

Cubre las vías de escritura de la aplicación: Autogestión (aplicador de
solicitudes), edición de RRHH (serializer/vista) y repositorio de personal.
La carga masiva usa la cédula solo como llave y no la reescribe: se documenta
en el reporte y no se modifica (la edita Antigravity).
"""
import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.autogestion.domain.entities.solicitud_actualizacion import CambioPropuesto
from apps.autogestion.domain.value_objects.secciones import (
    CAMPOS_IDENTIDAD_CON_CEDULA,
    CAMPOS_POR_SECCION,
)
from apps.autogestion.infrastructure.repositories.aplicador_cambios_orm import (
    AplicadorCambiosORM,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM
from apps.personal.presentation.views.personal_views import EmpleadoDetailView
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db

CEDULA = "99000449"
CEDULA_NUEVA = "99000450"


class UsuarioRRHH:
    is_authenticated = True
    is_active = True
    pk = 1

    def __init__(self):
        self.cedula_id = "99000300"

    def tiene_permiso(self, codigo: str) -> bool:
        return codigo in {"personal.ver", "personal.ver_detalle", "personal.editar_personales"}


def _empleado() -> EmployeeModel:
    sexo, _ = SexoModel.objects.get_or_create(sexo="M")
    nacionalidad, _ = NacionalidadModel.objects.get_or_create(
        pk=1, defaults={"codigo": "V", "nombre": "Venezolana"}
    )
    return EmployeeModel.objects.create(
        cedulaidentidad=CEDULA,
        nombres="BLOQUEO",
        apellidos="CEDULA",
        sexoid=sexo,
        nacionalidad_id=nacionalidad.pk,
    )


def test_autogestion_no_ofrece_la_cedula_como_campo_editable():
    assert "cedulaidentidad" not in CAMPOS_POR_SECCION["identidad"]["employee"]
    assert "cedulaidentidad" not in CAMPOS_IDENTIDAD_CON_CEDULA


def test_autogestion_rechaza_un_cambio_forjado_de_cedula():
    _empleado()
    cambio = CambioPropuesto(
        id="cambio-1",
        origen_tipo="ACTUALIZACION",
        origen_id="solicitud-1",
        seccion="identidad",
        accion="MODIFICAR",
        entidad_destino="employee",
        campo="cedulaidentidad",
        valor_propuesto=CEDULA_NUEVA,
    )

    with pytest.raises(ValidationError) as error:
        AplicadorCambiosORM().aplicar(CEDULA, [cambio], [], "actor")

    assert error.value.campo == "cedulaidentidad"
    assert EmployeeModel.objects.get(cedulaidentidad=CEDULA).cedulaidentidad == CEDULA
    assert not EmployeeModel.objects.filter(cedulaidentidad=CEDULA_NUEVA).exists()


def test_rrhh_rechaza_cambiar_la_cedula_en_la_api():
    _empleado()
    peticion = APIRequestFactory().put(
        f"/api/v1/personal/{CEDULA}/",
        {"cedula": CEDULA_NUEVA},
        format="json",
    )
    force_authenticate(peticion, user=UsuarioRRHH())

    respuesta = EmpleadoDetailView.as_view()(peticion, cedula=CEDULA)

    assert respuesta.status_code == 400
    assert "cédula" in str(respuesta.data).lower()
    assert EmployeeModel.objects.get(cedulaidentidad=CEDULA).cedulaidentidad == CEDULA


def test_repositorio_de_personal_rechaza_cedulaidentidad_distinta():
    _empleado()

    with pytest.raises(ValidationError) as error:
        RepoPersonalORM().actualizar_empleado(
            CEDULA, {"cedulaidentidad": CEDULA_NUEVA}
        )

    assert error.value.campo == "cedulaidentidad"
    assert EmployeeModel.objects.get(cedulaidentidad=CEDULA).cedulaidentidad == CEDULA
