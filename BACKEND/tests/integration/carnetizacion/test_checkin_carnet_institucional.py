"""Eventos: los trabajadores invitados entran con el QR de su carnet institucional."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.carnetizacion.application.dtos.evento_dtos import (
    CheckInRequestDTO,
    EventoCrearDTO,
    InvitadoCrearDTO,
)
from apps.carnetizacion.application.use_cases.control_entrada_evento import ControlEntradaEventoUseCase
from apps.carnetizacion.application.use_cases.gestionar_eventos import CrearEventoUseCase
from apps.carnetizacion.application.use_cases.gestionar_invitados import CrearInvitadoUseCase
from apps.carnetizacion.domain.entities.evento import EstadoInvitado, ResultadoControlEntrada
from apps.carnetizacion.domain.value_objects.security_hash import generar_codigo_qr
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    EventoInvitadoModel,
    EventoRegistroAccesoModel,
    MotivosEmisionModel,
)
from apps.carnetizacion.infrastructure.repositories.repo_eventos_orm import RepoEventosORM
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


@pytest.fixture
def evento():
    repo = RepoEventosORM()
    ahora = timezone.now()
    return CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Acto institucional",
            lugar="Auditorio",
            fecha_inicio=ahora - timedelta(hours=1),
            fecha_fin=ahora + timedelta(hours=5),
        )
    )


def _trabajador(cedula):
    NacionalidadModel.objects.get_or_create(id=1, defaults={"codigo": "V", "nombre": "Venezolano"})
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={"sexo": "MASCULINO"})
    MotivosEmisionModel.objects.get_or_create(id=1, defaults={"nombre": "Primera Emisión"})
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres="Ana", apellidos="Pérez", sexoid=sexo, nacionalidad_id=1,
    )


def _carnet(empleado, activo=True, vence=None):
    return CarnetEmitidoModel.objects.create(
        employee=empleado,
        security_hash=generar_codigo_qr(),
        motivo_id=1,
        activo=activo,
        fecha_vencimiento=vence or timezone.now() + timedelta(days=300),
    )


def _invitar(evento, empleado):
    return CrearInvitadoUseCase(RepoEventosORM()).ejecutar(
        InvitadoCrearDTO(
            evento_id=evento.id,
            nombre_completo=f"{empleado.nombres} {empleado.apellidos}",
            categoria_id=evento.categorias[0].id,
            zona_id=evento.zonas[0].id,
            documento_identidad=empleado.cedulaidentidad,
            trabajador_titular_id=empleado.pk,
        )
    )


def _escanear(evento, codigo):
    return ControlEntradaEventoUseCase(RepoEventosORM()).ejecutar(
        CheckInRequestDTO(codigo_o_hash=codigo, evento_id=evento.id, zona_id=None)
    )


def test_trabajador_invitado_entra_con_su_carnet(evento):
    ana = _trabajador("V-3001")
    invitado = _invitar(evento, ana)
    carnet = _carnet(ana)

    resp = _escanear(evento, carnet.security_hash)

    assert resp.resultado == ResultadoControlEntrada.ACCESO_PERMITIDO.value
    assert resp.invitado_id == invitado.id
    assert EventoInvitadoModel.objects.get(id=invitado.id).estado == EstadoInvitado.INGRESO.value
    assert EventoRegistroAccesoModel.objects.filter(invitado_id=invitado.id, resultado="ACCESO_PERMITIDO").count() == 1
    # Un segundo escaneo del mismo carnet no vuelve a registrar el ingreso.
    assert _escanear(evento, carnet.security_hash).resultado == ResultadoControlEntrada.YA_INGRESO.value


def test_el_qr_con_la_url_completa_tambien_funciona(evento):
    ana = _trabajador("V-3002")
    _invitar(evento, ana)
    carnet = _carnet(ana)

    resp = _escanear(evento, f"https://gath.conatel.gob.ve/carnet/{carnet.security_hash}")

    assert resp.resultado == ResultadoControlEntrada.ACCESO_PERMITIDO.value


def test_trabajador_no_invitado_es_rechazado(evento):
    ana = _trabajador("V-3003")
    carnet = _carnet(ana)

    resp = _escanear(evento, carnet.security_hash)

    assert resp.resultado == ResultadoControlEntrada.NO_VALIDA.value
    assert "No está en la lista de invitados" in resp.mensaje
    assert not EventoInvitadoModel.objects.filter(trabajador_titular=ana).exists()


def test_invitacion_anulada_se_trata_como_no_invitado(evento):
    ana = _trabajador("V-3004")
    invitado = _invitar(evento, ana)
    EventoInvitadoModel.objects.filter(id=invitado.id).update(estado=EstadoInvitado.ANULADO.value)

    resp = _escanear(evento, _carnet(ana).security_hash)

    assert resp.resultado == ResultadoControlEntrada.NO_VALIDA.value
    assert "No está en la lista de invitados" in resp.mensaje


def test_carnet_anulado_es_rechazado_aunque_este_invitado(evento):
    ana = _trabajador("V-3005")
    invitado = _invitar(evento, ana)
    carnet = _carnet(ana, activo=False)

    resp = _escanear(evento, carnet.security_hash)

    assert resp.resultado == ResultadoControlEntrada.NO_VALIDA.value
    assert "anulado" in resp.mensaje
    assert EventoInvitadoModel.objects.get(id=invitado.id).estado != EstadoInvitado.INGRESO.value


def test_carnet_vencido_es_rechazado(evento):
    ana = _trabajador("V-3006")
    _invitar(evento, ana)
    carnet = _carnet(ana, vence=timezone.now() - timedelta(days=1))

    resp = _escanear(evento, carnet.security_hash)

    assert resp.resultado == ResultadoControlEntrada.NO_VALIDA.value
    assert "vencido" in resp.mensaje


def test_codigo_desconocido_sigue_siendo_no_encontrado(evento):
    resp = _escanear(evento, generar_codigo_qr())
    assert resp.resultado == ResultadoControlEntrada.NO_VALIDA.value
    assert "no encontrada" in resp.mensaje


def test_el_gafete_de_un_externo_funciona_como_antes(evento):
    externo = CrearInvitadoUseCase(RepoEventosORM()).ejecutar(
        InvitadoCrearDTO(
            evento_id=evento.id,
            nombre_completo="Invitado Externo",
            categoria_id=evento.categorias[0].id,
            zona_id=evento.zonas[0].id,
            documento_identidad="V-99",
        )
    )
    resp = _escanear(evento, externo.security_hash)
    assert resp.resultado == ResultadoControlEntrada.ACCESO_PERMITIDO.value


def test_la_vista_de_checkin_acepta_el_carnet_del_trabajador(evento):
    class Usuario:
        is_authenticated = True
        is_active = True
        pk = 1
        id = None
        cedula_id = "V-1"
        rol_id = None

        def tiene_permiso(self, codigo):
            return True

    ana = _trabajador("V-3007")
    _invitar(evento, ana)
    carnet = _carnet(ana)
    api = APIClient()
    api.force_authenticate(user=Usuario())

    r = api.post(
        "/api/v1/carnetizacion/control-eventos/check-in/",
        {"codigo_o_hash": carnet.security_hash, "evento_id": evento.id},
        format="json",
    )

    assert r.status_code == 200, r.content
    assert r.json()["data"]["resultado"] == "ACCESO_PERMITIDO"
