"""O45-FIX: recorrido de endpoints GET y flujos principales por API."""
from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    MotivosEmisionModel,
    TipoCredencialModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

BASE = "/api/v1/carnetizacion"


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula="V-1"):
        # `id=None` evita crear FKs de auditoría con un usuario que no existe
        # en la BD de pruebas; `pk` sigue disponible para DRF.
        self.pk = 1
        self.id = None
        self.cedula_id = cedula
        self.rol_id = None

    def tiene_permiso(self, codigo):
        return True


@pytest.fixture(scope="module")
def tablas_legadas(django_db_setup, django_db_blocker):
    """Crea las tablas unmanaged que usa la API de carnets."""
    with django_db_blocker.unblock():
        existentes = set(connection.introspection.table_names())
        with connection.schema_editor() as schema:
            for modelo in (MotivosEmisionModel, CarnetEmitidoModel):
                if modelo._meta.db_table not in existentes:
                    schema.create_model(modelo)
    yield


@pytest.fixture
def datos_base(tablas_legadas):
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={"codigo": "V", "nombre": "Venezolana"}
    )
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo="M")
    empleado = EmployeeModel.objects.create(
        cedulaidentidad="V-1",
        nombres="ANA",
        apellidos="API",
        sexoid=sexo,
        nacionalidad_id=1,
    )
    motivo = MotivosEmisionModel.objects.create(nombre="EMISION API")
    carnet = CarnetEmitidoModel.objects.create(
        employee=empleado,
        motivo=motivo,
        security_hash="hash-api-o45fix",
        activo=True,
    )
    for codigo, grupo, orden in (
        ("trabajador", "trabajador", 1),
        ("pasivo", "pasivo", 2),
        ("visitante", "externo", 10),
        ("contratista", "externo", 11),
        ("trabajador_temporal", "temporal", 12),
    ):
        TipoCredencialModel.objects.get_or_create(
            codigo=codigo,
            defaults={
                "nombre": codigo.title(),
                "descripcion": codigo,
                "grupo": grupo,
                "ancho_mm": 54,
                "alto_mm": 85.6,
                "orientacion": "vertical",
                "activo": True,
                "orden": orden,
            },
        )
    api = APIClient()
    api.force_authenticate(user=Usuario(cedula="V-1"))
    return {"api": api, "empleado": empleado, "carnet": carnet}


def _crear_visitante(api: APIClient) -> dict:
    ahora = timezone.now()
    respuesta = api.post(
        f"{BASE}/credenciales-externas/",
        {
            "tipo_codigo": "visitante",
            "nombre": "VISITANTE API",
            "documento": "V-77777777",
            "motivo": "Prueba API",
            "vigencia_desde": ahora.isoformat(),
            "vigencia_hasta": (ahora + timedelta(hours=4)).isoformat(),
            "correo": "api.visitante@example.com",
        },
        format="json",
    )
    assert respuesta.status_code == 201, respuesta.content
    return respuesta.json()["data"]


def _crear_evento(api: APIClient) -> dict:
    ahora = timezone.now()
    respuesta = api.post(
        f"{BASE}/eventos/",
        {
            "nombre": "Evento API O45FIX",
            "lugar": "Sala de prueba",
            "fecha_inicio": (ahora + timedelta(days=1)).isoformat(),
            "fecha_fin": (ahora + timedelta(days=2)).isoformat(),
            "descripcion": "Evento de prueba",
        },
        format="json",
    )
    assert respuesta.status_code == 201, respuesta.content
    return respuesta.json()["data"]


def test_todos_los_get_de_carnetizacion(datos_base):
    api = datos_base["api"]
    carnet = datos_base["carnet"]

    # Preparar datos de eventos y una plantilla activa.
    evento = _crear_evento(api)
    categoria = api.post(
        f"{BASE}/eventos/{evento['id']}/categorias/",
        {"nombre": "Invitados", "color_primario": "#123456", "color_acento": "#abcdef"},
        format="json",
    )
    assert categoria.status_code == 201, categoria.content
    zona = api.post(
        f"{BASE}/eventos/{evento['id']}/zonas/",
        {"nombre": "Principal", "codigo": "A1"},
        format="json",
    )
    assert zona.status_code == 201, zona.content
    invitado = api.post(
        f"{BASE}/eventos/{evento['id']}/invitados/",
        {
            "evento_id": evento["id"],
            "nombre_completo": "INVITADO API",
            "categoria_id": categoria.json()["data"]["id"],
            "zona_id": zona.json()["data"]["id"],
        },
        format="json",
    )
    assert invitado.status_code == 201, invitado.content
    visitante = _crear_visitante(api)

    plantillas = api.get(f"{BASE}/plantillas-motor/")
    assert plantillas.status_code == 200, plantillas.content
    filas = plantillas.json()["data"]
    if filas:
        plantilla_id = filas[0]["id"]
    else:
        activa = api.get(f"{BASE}/plantillas-motor/activa/")
        assert activa.status_code == 200, activa.content
        plantilla_id = activa.json()["data"]["id"]

    rutas = [
        f"{BASE}/",
        f"{BASE}/buscar/?q=ANA",
        f"{BASE}/motivos/",
        f"{BASE}/estadisticas/",
        f"{BASE}/tipos-credencial/",
        f"{BASE}/tipos-credencial/?grupo=externo",
        f"{BASE}/tipos-credencial/?grupo=temporal",
        f"{BASE}/plantillas-motor/",
        f"{BASE}/plantillas-motor/activa/",
        f"{BASE}/plantillas-motor/default/",
        f"{BASE}/plantillas-motor/{plantilla_id}/",
        f"{BASE}/plantillas-motor/{plantilla_id}/versiones/",
        f"{BASE}/biblioteca/",
        f"{BASE}/campos/",
        f"{BASE}/plantillas/",
        f"{BASE}/validar/hash/{carnet.security_hash}/",
        f"{BASE}/validar/{carnet.id}/",
        f"{BASE}/{carnet.id}/pdf/",
        f"{BASE}/credenciales-externas/",
        f"{BASE}/credenciales-temporales/",
        f"{BASE}/credenciales-externas/{visitante['id']}/",
        f"{BASE}/credenciales-externas/{visitante['id']}/pdf/",
        f"{BASE}/public/qr/{visitante['security_hash']}/",
        f"{BASE}/public/qr/{visitante['security_hash']}/imagen/",
        f"{BASE}/autogestion/privacidad/",
        f"{BASE}/eventos/",
        f"{BASE}/eventos/?busqueda=API",
        f"{BASE}/eventos/{evento['id']}/",
        f"{BASE}/eventos/{evento['id']}/categorias/",
        f"{BASE}/eventos/{evento['id']}/zonas/",
        f"{BASE}/eventos/{evento['id']}/invitados/",
        f"{BASE}/eventos/{evento['id']}/panel/",
        f"{BASE}/eventos/{evento['id']}/pdf/?invitado_id={invitado.json()['data']['id']}",
    ]
    for ruta in rutas:
        respuesta = api.get(ruta)
        assert respuesta.status_code in (200, 304), (ruta, respuesta.status_code, respuesta.content[:300])


def test_flujo_visitante_y_temporal(datos_base):
    api = datos_base["api"]
    visitante = _crear_visitante(api)

    assert api.post(f"{BASE}/credenciales-externas/{visitante['id']}/devolver/").status_code == 200
    assert api.post(f"{BASE}/credenciales-externas/{visitante['id']}/anular/").status_code == 200
    lote = api.post(
        f"{BASE}/credenciales-externas/lote/pdf/",
        {"ids": [visitante["id"]]},
        format="json",
    )
    assert lote.status_code == 200
    assert lote.content.startswith(b"%PDF")
    correo = api.post(
        f"{BASE}/credenciales-externas/{visitante['id']}/enviar/", {}, format="json"
    )
    assert correo.status_code == 200, correo.content

    ahora = timezone.now()
    temporal = api.post(
        f"{BASE}/credenciales-temporales/",
        {
            "tipo_codigo": "trabajador_temporal",
            "nombre": "ANA API",
            "documento": "V-1",
            "motivo": "Olvido",
            "vigencia_desde": ahora.isoformat(),
            "vigencia_hasta": (ahora + timedelta(hours=2)).isoformat(),
            "empleado_cedula": "V-1",
        },
        format="json",
    )
    assert temporal.status_code == 201, temporal.content
    assert api.get(f"{BASE}/credenciales-temporales/").status_code == 200


def test_flujo_evento_invitado_y_control_entrada(datos_base):
    api = datos_base["api"]
    evento = _crear_evento(api)
    categoria = api.post(
        f"{BASE}/eventos/{evento['id']}/categorias/",
        {"nombre": "Invitados", "color_primario": "#123456", "color_acento": "#abcdef"},
        format="json",
    ).json()["data"]
    zona = api.post(
        f"{BASE}/eventos/{evento['id']}/zonas/",
        {"nombre": "Principal", "codigo": "A1"},
        format="json",
    ).json()["data"]
    invitado = api.post(
        f"{BASE}/eventos/{evento['id']}/invitados/",
        {
            "evento_id": evento["id"],
            "nombre_completo": "INVITADO API",
            "categoria_id": categoria["id"],
            "zona_id": zona["id"],
            "correo": "invitado.api@example.com",
        },
        format="json",
    )
    assert invitado.status_code == 201, invitado.content
    invitado_id = invitado.json()["data"]["id"]

    emitir = api.post(
        f"{BASE}/eventos/{evento['id']}/emitir-lote/",
        {"invitados_ids": [invitado_id]},
        format="json",
    )
    assert emitir.status_code == 200, emitir.content

    listado = api.get(f"{BASE}/eventos/{evento['id']}/invitados/")
    assert listado.status_code == 200
    fila = next(f for f in listado.json()["data"] if str(f["id"]) == str(invitado_id))
    codigo = fila.get("security_hash") or fila.get("codigo_credencial")
    assert codigo

    checkin = api.post(
        f"{BASE}/control-eventos/check-in/",
        {
            "codigo_o_hash": codigo,
            "evento_id": evento["id"],
            "zona_id": zona["id"],
        },
        format="json",
    )
    assert checkin.status_code == 200, checkin.content
    assert checkin.json()["data"]["resultado"] in ("ACCESO_PERMITIDO", "YA_INGRESO")
    assert api.get(f"{BASE}/eventos/{evento['id']}/panel/").status_code == 200
