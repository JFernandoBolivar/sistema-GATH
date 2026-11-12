"""Agregar invitados a un evento desde personas registradas, y zonas/categorías editables."""
import secrets
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.carnetizacion.domain.entities.persona_origen import TOPE_AGREGAR_EN_BLOQUE
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    EventoInvitadoModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
    CredencialExternaModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

BASE = "/api/v1/carnetizacion/eventos"


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permitido=True):
        self.pk = 1
        self.id = None
        self.cedula_id = "V-1"
        self.rol_id = None
        self._permitido = permitido

    def tiene_permiso(self, codigo):
        return self._permitido


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


@pytest.fixture
def evento(api):
    ahora = timezone.now()
    ev = api.post(
        f"{BASE}/",
        {
            "nombre": "Evento registrados",
            "lugar": "Sala",
            "fecha_inicio": (ahora + timedelta(days=1)).isoformat(),
            "fecha_fin": (ahora + timedelta(days=2)).isoformat(),
        },
        format="json",
    ).json()["data"]
    cat = api.post(f"{BASE}/{ev['id']}/categorias/", {"nombre": "General"}, format="json").json()["data"]
    zona = api.post(f"{BASE}/{ev['id']}/zonas/", {"nombre": "Sala", "codigo": "S"}, format="json").json()["data"]
    return {"id": ev["id"], "cat": cat["id"], "zona": zona["id"]}


@pytest.fixture
def trabajadores():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={"codigo": "V", "nombre": "VENEZOLANO"})
    sexo = SexoModel.objects.create(sexo="M")
    return [
        EmployeeModel.objects.create(
            cedulaidentidad=f"V-{1000 + n}", nombres=f"Nombre{n}", apellidos=f"Apellido{n}", sexoid=sexo
        )
        for n in range(5)
    ]


def _bloque(api, evento, **cuerpo):
    return api.post(
        f"{BASE}/{evento['id']}/invitados/agregar-en-bloque/",
        {"categoria_id": evento["cat"], "zona_id": evento["zona"], **cuerpo},
        format="json",
    )


def test_agrega_por_poblacion_con_titular_y_auditoria(api, evento, trabajadores):
    r = _bloque(api, evento, poblacion="TODOS")
    assert r.status_code == 201, r.content
    assert r.json()["data"]["agregados"] == 5
    inv = EventoInvitadoModel.objects.filter(evento_id=evento["id"])
    assert inv.count() == 5
    uno = inv.get(documento_identidad="V-1000")
    assert uno.nombre_completo == "Nombre0 Apellido0"
    assert uno.trabajador_titular_id == trabajadores[0].pk
    assert len({i.codigo_credencial for i in inv}) == 5
    assert AuditoriaLog.objects.filter(accion="EVENTO_INVITADOS_AGREGADOS_EN_BLOQUE").exists()


def test_agrega_por_cedulas_e_ignora_duplicados(api, evento, trabajadores):
    assert _bloque(api, evento, cedulas=["V-1000", "V-1001"]).json()["data"]["agregados"] == 2
    r = _bloque(api, evento, cedulas=["V-1001", "V-1002"]).json()["data"]
    assert (r["agregados"], r["duplicados"]) == (1, 1)
    assert EventoInvitadoModel.objects.filter(evento_id=evento["id"]).count() == 3


def test_listado_marca_ya_invitado_y_exige_dos_caracteres(api, evento, trabajadores):
    _bloque(api, evento, cedulas=["V-1000"])
    url = f"{BASE}/{evento['id']}/invitables/personal/"
    filas = api.get(url, {"poblacion": "TODOS", "busqueda": "Nombre"}).json()["data"]
    assert filas["total"] == 5
    por_doc = {f["documento"]: f for f in filas["resultados"]}
    assert por_doc["V-1000"]["ya_invitado"] is True
    assert por_doc["V-1001"]["ya_invitado"] is False
    assert api.get(url, {"busqueda": "N"}).json()["data"]["total"] == 0
    ids = api.get(f"{url}ids/", {"poblacion": "TODOS"}).json()["data"]
    assert ids["total"] == 4 and "V-1000" not in ids["ids"]


def test_poblacion_activos_sin_asignacion_no_trae_a_nadie(api, evento, trabajadores):
    r = _bloque(api, evento, poblacion="ACTIVOS")
    assert r.status_code == 200 and r.json()["data"]["agregados"] == 0
    assert _bloque(api, evento, poblacion="INVENTADA").status_code == 400


def test_agrega_externos_registrados(api, evento):
    tipo, _ = TipoCredencialModel.objects.get_or_create(
        codigo="visitante",
        defaults={"nombre": "Visitante", "grupo": "externo", "activo": True, "orden": 99},
    )
    ahora = timezone.now()
    ext = CredencialExternaModel.objects.create(
        tipo_credencial=tipo, nombre="Luis Visita", documento="V-777", empresa="ACME",
        motivo="Reunión", vigencia_desde=ahora, vigencia_hasta=ahora + timedelta(days=1),
        security_hash=secrets.token_hex(32),
    )
    lista = api.get(f"{BASE}/{evento['id']}/invitables/externos/", {"busqueda": "Luis"}).json()["data"]
    assert lista["total"] == 1 and lista["resultados"][0]["ya_invitado"] is False
    r = _bloque(api, evento, externos_ids=[str(ext.pk)])
    assert r.json()["data"]["agregados"] == 1
    inv = EventoInvitadoModel.objects.get(evento_id=evento["id"])
    assert inv.documento_identidad == "V-777" and inv.trabajador_titular_id is None
    lista = api.get(f"{BASE}/{evento['id']}/invitables/externos/", {"busqueda": "Luis"}).json()["data"]
    assert lista["resultados"][0]["ya_invitado"] is True


def test_tope_de_la_operacion(api, evento):
    r = _bloque(api, evento, cedulas=[f"X-{n}" for n in range(TOPE_AGREGAR_EN_BLOQUE + 1)])
    assert r.status_code == 400
    assert str(TOPE_AGREGAR_EN_BLOQUE) in r.json()["message"]


def test_sin_permiso_no_agrega(evento, trabajadores):
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario(permitido=False))
    r = _bloque(cliente, evento, poblacion="TODOS")
    assert r.status_code == 403
    assert cliente.get(f"{BASE}/{evento['id']}/invitables/personal/").status_code == 403
    assert EventoInvitadoModel.objects.count() == 0


def test_zonas_y_categorias_renombrar_y_eliminar(api, evento, trabajadores):
    r = api.patch(f"{BASE}/categorias/{evento['cat']}/", {"nombre": "VIP", "color_primario": "#112233"}, format="json")
    assert r.status_code == 200 and r.json()["data"]["nombre"] == "VIP"
    r = api.patch(f"{BASE}/zonas/{evento['zona']}/", {"nombre": "Auditorio"}, format="json")
    assert r.json()["data"]["nombre"] == "Auditorio"

    _bloque(api, evento, cedulas=["V-1000", "V-1001"])
    r = api.delete(f"{BASE}/categorias/{evento['cat']}/")
    assert r.status_code == 409 and "2 invitados" in r.json()["message"]
    r = api.delete(f"{BASE}/zonas/{evento['zona']}/")
    assert r.status_code == 409 and "2 invitados" in r.json()["message"]

    libre = api.post(f"{BASE}/{evento['id']}/zonas/", {"nombre": "Libre"}, format="json").json()["data"]
    assert api.delete(f"{BASE}/zonas/{libre['id']}/").status_code == 200
    assert api.delete(f"{BASE}/zonas/{libre['id']}/").status_code == 404


def test_zonas_y_categorias_exigen_permiso(evento):
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario(permitido=False))
    assert cliente.patch(f"{BASE}/categorias/{evento['cat']}/", {"nombre": "x"}, format="json").status_code == 403
    assert cliente.delete(f"{BASE}/zonas/{evento['zona']}/").status_code == 403
