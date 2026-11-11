"""Invitados de un evento: listado paginado y filtrado en el servidor + ids del filtro."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.carnetizacion.infrastructure.repositories.repo_eventos_orm import (
    RepoEventosORM,
)

pytestmark = pytest.mark.django_db

BASE = "/api/v1/carnetizacion/eventos"


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self):
        self.pk = 1
        self.id = None
        self.cedula_id = "V-1"
        self.rol_id = None

    def tiene_permiso(self, codigo):
        return True


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


@pytest.fixture
def evento(api):
    """Evento con 2 categorías y 2 zonas y 12 invitados INV-01..INV-12 (pares: cat B, zona 2)."""
    ahora = timezone.now()
    ev = api.post(
        f"{BASE}/",
        {
            "nombre": "Evento paginado",
            "lugar": "Sala",
            "fecha_inicio": (ahora + timedelta(days=1)).isoformat(),
            "fecha_fin": (ahora + timedelta(days=2)).isoformat(),
        },
        format="json",
    ).json()["data"]
    cats = [
        api.post(f"{BASE}/{ev['id']}/categorias/", {"nombre": n}, format="json").json()["data"]
        for n in ("A", "B")
    ]
    zonas = [
        api.post(f"{BASE}/{ev['id']}/zonas/", {"nombre": n, "codigo": c}, format="json").json()["data"]
        for n, c in (("Z1", "Z1"), ("Z2", "Z2"))
    ]
    for n in range(1, 13):
        par = n % 2 == 0
        r = api.post(
            f"{BASE}/{ev['id']}/invitados/",
            {
                "nombre_completo": f"INV-{n:02d}",
                "categoria_id": cats[1 if par else 0]["id"],
                "zona_id": zonas[1 if par else 0]["id"],
            },
            format="json",
        )
        assert r.status_code == 201, r.content
    return {"id": ev["id"], "cats": cats, "zonas": zonas}


def _nombres(respuesta):
    return [i["nombre_completo"] for i in respuesta.json()["data"]["resultados"]]


def test_repo_pagina_y_total(evento):
    repo = RepoEventosORM()
    pagina1, total = repo.listar_invitados_paginado(evento["id"], 0, 5)
    pagina3, _ = repo.listar_invitados_paginado(evento["id"], 10, 5)
    assert total == 12
    assert [i.nombre_completo for i in pagina1] == [f"INV-{n:02d}" for n in range(1, 6)]
    assert [i.nombre_completo for i in pagina3] == ["INV-11", "INV-12"]


def test_repo_filtros_afectan_total_y_pagina(evento):
    repo = RepoEventosORM()
    invitados, total = repo.listar_invitados_paginado(
        evento["id"], 0, 4, categoria_id=evento["cats"][1]["id"]
    )
    assert total == 6
    assert [i.nombre_completo for i in invitados] == ["INV-02", "INV-04", "INV-06", "INV-08"]
    _, total_busqueda = repo.listar_invitados_paginado(evento["id"], 0, 4, busqueda="inv-1")
    assert total_busqueda == 3  # INV-10, INV-11, INV-12


def test_repo_ids_del_filtro_sin_paginar(evento):
    repo = RepoEventosORM()
    todos = repo.listar_ids_invitados(evento["id"])
    zona2 = repo.listar_ids_invitados(evento["id"], zona_id=evento["zonas"][1]["id"])
    assert len(todos) == 12 and len(set(todos)) == 12
    assert len(zona2) == 6 and set(zona2) <= set(todos)


def test_api_primera_pagina(evento, api):
    r = api.get(f"{BASE}/{evento['id']}/invitados/", {"page_size": 5})
    assert r.status_code == 200, r.content
    datos = r.json()["data"]
    assert (datos["total"], datos["pagina"], datos["tamano"], datos["total_paginas"]) == (12, 1, 5, 3)
    assert _nombres(r) == [f"INV-{n:02d}" for n in range(1, 6)]
    assert datos["resultados"][0]["categoria_nombre"] == "A"
    assert datos["resultados"][0]["zona_nombre"] == "Z1"


def test_api_segunda_pagina(evento, api):
    r = api.get(f"{BASE}/{evento['id']}/invitados/", {"pagina": 2, "page_size": 5})
    assert _nombres(r) == [f"INV-{n:02d}" for n in range(6, 11)]


def test_api_por_defecto_diez_por_pagina(evento, api):
    datos = api.get(f"{BASE}/{evento['id']}/invitados/").json()["data"]
    assert datos["tamano"] == 10
    assert len(datos["resultados"]) == 10
    assert datos["total_paginas"] == 2


def test_api_tope_de_cincuenta(evento, api):
    datos = api.get(f"{BASE}/{evento['id']}/invitados/", {"page_size": 999}).json()["data"]
    assert datos["tamano"] == 50


def test_api_filtros_de_servidor(evento, api):
    url = f"{BASE}/{evento['id']}/invitados/"
    por_cat = api.get(url, {"categoria_id": evento["cats"][0]["id"]}).json()["data"]
    assert por_cat["total"] == 6
    por_busqueda = api.get(url, {"busqueda": "INV-07"}).json()["data"]
    assert por_busqueda["total"] == 1
    combinado = api.get(url, {"zona_id": evento["zonas"][1]["id"], "busqueda": "INV-1"}).json()["data"]
    assert [i["nombre_completo"] for i in combinado["resultados"]] == ["INV-10", "INV-12"]
    vacio = api.get(url, {"pagina": 1, "busqueda": "NO-EXISTE"}).json()["data"]
    assert vacio["total"] == 0 and vacio["total_paginas"] == 1 and vacio["resultados"] == []


def test_api_parametros_invalidos_son_400(evento, api):
    url = f"{BASE}/{evento['id']}/invitados/"
    assert api.get(url, {"pagina": "x"}).status_code == 400
    assert api.get(url, {"page_size": 0}).status_code == 400


def test_api_ids_del_filtro_alimentan_la_emision_por_lote(evento, api):
    url = f"{BASE}/{evento['id']}/invitados/ids/"
    todos = api.get(url).json()["data"]
    assert todos["total"] == 12 and len(todos["ids"]) == 12

    filtrados = api.get(url, {"categoria_id": evento["cats"][1]["id"]}).json()["data"]
    assert filtrados["total"] == 6

    lote = api.post(
        f"{BASE}/{evento['id']}/emitir-lote/", {"invitados_ids": filtrados["ids"]}, format="json"
    )
    assert lote.status_code == 200, lote.content
    assert lote.json()["data"]["total_emitidos"] == 6
    emitidos = api.get(
        f"{BASE}/{evento['id']}/invitados/ids/", {"estado": "emitido"}
    ).json()["data"]
    assert set(emitidos["ids"]) == set(filtrados["ids"])


def test_api_emitir_sin_ids_sigue_abarcando_todo_el_evento(evento, api):
    lote = api.post(f"{BASE}/{evento['id']}/emitir-lote/", {}, format="json")
    assert lote.json()["data"]["total_emitidos"] == 12
