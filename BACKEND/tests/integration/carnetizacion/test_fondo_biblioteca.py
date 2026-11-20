"""B-2: fondo por cara de la Biblioteca en la definición, el snapshot y la API.

Cubre la ida y vuelta de la definición, que la emisión congele los fondos en el
snapshot, y que un PDF histórico se convierta a PNG (o se rechace con un mensaje
claro si el servidor no tiene rasterizador).
"""
import uuid
from io import BytesIO

import pytest
from pdf2image import convert_from_bytes
from PIL import Image
from reportlab.pdfgen import canvas
from rest_framework.test import APIClient

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    ElementoBibliotecaModel,
    MotivosEmisionModel,
    PlantillaCarnetModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.pdf import carnet_pdf, rasterizar_pdf
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
    RepoCarnetizacionORM,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

pytestmark = pytest.mark.django_db

BASE = '/api/v1/carnetizacion'
FONDOS = {
    'anverso': {'biblioteca_id': 'medio-anv', 'nombre': 'Fondo anverso', 'mime_type': 'image/png'},
    'reverso': {'biblioteca_id': 'medio-rev', 'nombre': 'Fondo reverso', 'mime_type': 'image/png'},
}


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self):
        self.pk = 1
        self.id = None
        self.cedula_id = 'V-1'
        self.rol_id = None

    def tiene_permiso(self, codigo):
        return True


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


def _png(color=(255, 0, 0)) -> bytes:
    salida = BytesIO()
    Image.new('RGB', (40, 60), color).save(salida, format='PNG')
    return salida.getvalue()


def _pdf_rojo() -> bytes:
    salida = BytesIO()
    c = canvas.Canvas(salida, pagesize=(100, 100))
    c.setFillColorRGB(1, 0, 0)
    c.rect(0, 0, 100, 100, fill=1, stroke=0)
    c.showPage()
    c.save()
    return salida.getvalue()


def _pixel_esquina(pdf: bytes) -> tuple[int, int, int]:
    with convert_from_bytes(pdf, first_page=1, last_page=1, dpi=72)[0] as img:
        return img.convert('RGB').getpixel((3, 3))


def _cerca(color: tuple[int, int, int], esperado: tuple[int, int, int], tolerancia: int = 3) -> bool:
    return all(abs(c - e) <= tolerancia for c, e in zip(color, esperado))


def test_definicion_con_fondos_sobrevive_guardar_y_recargar(api):
    TipoCredencialModel.objects.get_or_create(codigo='trabajador', defaults={'nombre': 'Trabajador'})
    respuesta = api.post(
        f'{BASE}/plantillas-motor/',
        {
            'nombre': 'Plantilla con fondos B-2',
            'codigo_tipo': 'trabajador',
            'definicion': {'anverso': [], 'reverso': [], 'fondos': FONDOS},
        },
        format='json',
    )
    assert respuesta.status_code == 201, respuesta.content
    plantilla_id = respuesta.json()['data']['id']
    assert respuesta.json()['data']['definicion']['fondos'] == FONDOS

    detalle = api.get(f'{BASE}/plantillas-motor/{plantilla_id}/')
    assert detalle.status_code == 200
    assert detalle.json()['data']['definicion']['fondos'] == FONDOS

    nuevos = {'anverso': {'biblioteca_id': 'otro-anv', 'mime_type': 'image/jpeg'}}
    actualizado = api.put(
        f'{BASE}/plantillas-motor/{plantilla_id}/',
        {'definicion': {'anverso': [], 'reverso': [], 'fondos': nuevos}},
        format='json',
    )
    assert actualizado.status_code == 200, actualizado.content

    detalle = api.get(f'{BASE}/plantillas-motor/{plantilla_id}/')
    assert detalle.json()['data']['definicion']['fondos'] == nuevos


@pytest.fixture
def escenario_emision():
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANA'})
    sexo = SexoModel.objects.create(sexo='F')
    MotivosEmisionModel.objects.get_or_create(id=1, defaults={'nombre': 'Primera Emisión'})
    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    tipo_personal = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='EMPLEADO FIJO', es_activo=True)
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    cargo_esp = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA')
    dep = DependenciaModel.objects.create(Codigo='NA', dependencia='NIVEL DE APOYO')
    dg = DireccionGeneralModel.objects.create(
        Codigo='DG-GH', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dep,
    )
    TipoCredencialModel.objects.get_or_create(codigo='trabajador', defaults={'nombre': 'Trabajador'})
    empleado = EmployeeModel.objects.create(
        cedulaidentidad='7799001', nombres='ANA', apellidos='FONDO', sexoid=sexo, nacionalidad_id=1,
    )
    AsigTrabajoModel.objects.create(
        employee=empleado, codigo=f'C-{uuid.uuid4().hex[:12]}',
        denominacioncargoid=cargo, denominacioncargoespecificoid=cargo_esp, tiponominaid=nomina,
        estatusid=estatus, Tipo_personal=tipo_personal, Dependencia=dep, DireccionGeneral=dg,
    )
    return empleado


def test_emision_congela_los_fondos_y_reimprime_con_el_snapshot(escenario_emision, monkeypatch):
    definicion = {
        'dimensiones': {'ancho_mm': 54, 'alto_mm': 85.6},
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
        'fondos': {'anverso': {'biblioteca_id': 'rojo'}},
        'anverso': [],
        'reverso': [],
    }
    plantilla = PlantillaCarnetModel.objects.create(
        nombre='Fondo congelado B-2', tipo_credencial_id='trabajador', estado='publicada',
        activa=True, version=1, regla_criterio='nomina', regla_valor='*', definicion=definicion,
    )
    repo = RepoCarnetizacionORM()
    carnet = repo.emitir_carnet('7799001', 1, plantilla_id=str(plantilla.id))

    assert carnet.plantilla_snapshot['fondos'] == definicion['fondos']

    # Cambiar la plantilla viva no altera el carnet ya emitido: manda el snapshot.
    plantilla.definicion = {**definicion, 'fondos': {'anverso': {'biblioteca_id': 'azul'}}}
    plantilla.save(update_fields=['definicion'])
    monkeypatch.setattr(
        carnet_pdf, 'fondo_de_biblioteca',
        lambda medio_id: _png((255, 0, 0)) if medio_id == 'rojo' else _png((0, 0, 255)),
    )

    assert _cerca(_pixel_esquina(repo.generar_pdf(carnet.id)), (255, 0, 0))


def test_api_convierte_la_primera_pagina_del_pdf_en_un_png_de_fondo(api, monkeypatch):
    contenido = _pdf_rojo()
    medio = ElementoBibliotecaModel.objects.create(
        nombre='Fondo PDF histórico', categoria='imagen', archivo_clave='prueba/fondo.pdf',
        nombre_archivo='fondo.pdf', tamano_bytes=len(contenido), mime_type='application/pdf',
    )
    monkeypatch.setattr(SeaweedFSStorage, 'descargar', lambda self, _clave: contenido)
    subidos: dict[str, bytes] = {}
    monkeypatch.setattr(
        SeaweedFSStorage, 'subir',
        lambda self, clave, datos, mime='application/octet-stream': subidos.setdefault(clave, datos),
    )

    respuesta = api.post(f'{BASE}/biblioteca/{medio.pk}/rasterizar-fondo/', {}, format='json')

    assert respuesta.status_code == 201, respuesta.content
    data = respuesta.json()['data']
    assert data['mime_type'] == 'image/png'
    assert data['nombre'].endswith('(fondo)')
    creado = ElementoBibliotecaModel.objects.get(pk=data['id'])
    assert creado.nombre_archivo.endswith('-fondo.png')
    guardado = subidos[creado.archivo_clave]
    assert guardado.startswith(b'\x89PNG\r\n')
    with Image.open(BytesIO(guardado)) as png:
        assert png.getpixel((3, 3)) == (255, 0, 0)


def test_api_reutiliza_el_png_si_se_elige_dos_veces_el_mismo_pdf(api, monkeypatch):
    contenido = _pdf_rojo()
    medio = ElementoBibliotecaModel.objects.create(
        nombre='Fondo PDF repetido', categoria='imagen', archivo_clave='prueba/repetido.pdf',
        nombre_archivo='repetido.pdf', tamano_bytes=len(contenido), mime_type='application/pdf',
    )
    monkeypatch.setattr(SeaweedFSStorage, 'descargar', lambda self, _clave: contenido)
    monkeypatch.setattr(
        SeaweedFSStorage, 'subir',
        lambda self, clave, datos, mime='application/octet-stream': None,
    )

    primera = api.post(f'{BASE}/biblioteca/{medio.pk}/rasterizar-fondo/', {}, format='json')
    segunda = api.post(f'{BASE}/biblioteca/{medio.pk}/rasterizar-fondo/', {}, format='json')

    assert primera.status_code == 201, primera.content
    assert segunda.status_code == 200, segunda.content
    assert segunda.json()['data']['id'] == primera.json()['data']['id']
    assert ElementoBibliotecaModel.objects.filter(nombre__endswith='(fondo)').count() == 1


def test_api_rechaza_el_pdf_sin_rasterizador_con_mensaje_claro(api, monkeypatch):
    contenido = _pdf_rojo()
    medio = ElementoBibliotecaModel.objects.create(
        nombre='Fondo PDF sin poppler', categoria='imagen', archivo_clave='prueba/sin.pdf',
        nombre_archivo='sin.pdf', tamano_bytes=len(contenido), mime_type='application/pdf',
    )
    monkeypatch.setattr(SeaweedFSStorage, 'descargar', lambda self, _clave: contenido)
    monkeypatch.setattr(rasterizar_pdf.shutil, 'which', lambda _binario: None)

    respuesta = api.post(f'{BASE}/biblioteca/{medio.pk}/rasterizar-fondo/', {}, format='json')

    assert respuesta.status_code == 400, respuesta.content
    mensaje = respuesta.json()['message'].lower()
    assert 'convierta la página a png' in mensaje
    assert not ElementoBibliotecaModel.objects.filter(nombre__endswith='(fondo)').exists()
