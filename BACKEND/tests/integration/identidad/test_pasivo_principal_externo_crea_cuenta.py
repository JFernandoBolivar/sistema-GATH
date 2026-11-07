"""FIX-AUD8.7: un pasivo con correo principal externo (gmail) recibe su cuenta sola.

El correo principal de un pasivo es el de la ficha sea cual sea su dominio: al
guardarlo desde Gestión de Trabajadores la cuenta se crea sin pasar por el panel
manual. Los activos conservan la regla del dominio institucional.
"""
import pytest

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.domain.events import TipoEventoIdentidad
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

CEDULA = '4588543'


@pytest.fixture
def eventos(monkeypatch):
    emitidos = []
    monkeypatch.setattr(
        'apps.identidad.infrastructure.receivers.publicar_evento_identidad',
        emitidos.append,
    )
    return emitidos


@pytest.fixture
def base(monkeypatch):
    NacionalidadModel.objects.get_or_create(
        id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'},
    )
    sexo = SexoModel.objects.create(sexo='F')
    RolModel.objects.get_or_create(
        nombre_rol='AUTOGESTION', defaults={'descripcion_rol': 'Autogestión'},
    )
    monkeypatch.setattr(
        RepoCondicionTrabajadorORM,
        'condicion_por_cedula',
        lambda self, cedula: (
            CondicionTrabajador.PASIVO
            if str(cedula) == CEDULA
            else CondicionTrabajador.SIN_ASIGNACION
        ),
    )
    return sexo


def test_pasivo_con_correo_principal_gmail_recibe_cuenta_al_guardarlo(base, eventos):
    EmployeeModel.objects.create(
        cedulaidentidad=CEDULA,
        nombres='JOSE',
        apellidos='PEREZ',
        sexoid=base,
        correo='jose.perez@gmail.com',
    )

    cuenta = CuentaModel.objects.get(cedula_id=CEDULA)
    assert cuenta.rol.nombre_rol == 'AUTOGESTION'
    assert any(
        evento.tipo == TipoEventoIdentidad.CUENTA_CREADA and evento.cedula == CEDULA
        for evento in eventos
    )
