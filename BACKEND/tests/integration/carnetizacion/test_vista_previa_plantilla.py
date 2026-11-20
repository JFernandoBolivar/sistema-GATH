"""
Vista previa con el motor PDF y las dos caras (seguimiento B-1): de una plantilla en borrador,
de cambios sin guardar y del carnet que se emitiría (consola), incluido el reverso real.
"""
import base64
from io import BytesIO

import pytest
from PIL import Image
from rest_framework.test import APIClient

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    PlantillaCarnetModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.repositories import repo_carnetizacion_comun as comun_mod
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

ROJO = '#ff0000'
AZUL = '#0000ff'


class Usuario:
    is_authenticated = True
    is_active = True
    pk = 1
    id = None
    cedula_id = '7730000'
    rol_id = None

    def tiene_permiso(self, codigo):
        return True


def _definicion(color_anverso, color_reverso):
    return {
        'dimensiones': {'ancho_mm': 54, 'alto_mm': 85.6},
        'bg': {'anverso': color_anverso, 'reverso': color_reverso},
        'anverso': [{'id': 'n', 'tipo': 'field', 'campo': 'nombre_completo', 'x': 2, 'y': 40, 'w': 50, 'h': 8}],
        'reverso': [{'id': 'q', 'tipo': 'qr', 'x': 15, 'y': 30, 'w': 24, 'h': 24}],
    }


def _color_dominante(data_url: str) -> tuple[int, int, int]:
    """Color de un píxel del borde (el fondo de la cara)."""
    png = base64.b64decode(data_url.split(',', 1)[1])
    with Image.open(BytesIO(png)) as img:
        return img.convert('RGB').getpixel((2, 2))


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(user=Usuario())
    return cliente


@pytest.fixture
def borrador():
    TipoCredencialModel.objects.get_or_create(codigo='trabajador', defaults={'nombre': 'Trabajador'})
    return PlantillaCarnetModel.objects.create(
        nombre='Borrador vista previa', tipo_credencial_id='trabajador', estado='borrador',
        activa=False, version=1, definicion=_definicion(ROJO, AZUL),
    )


def test_vista_previa_de_un_borrador_trae_las_dos_caras(api, borrador):
    respuesta = api.post(f'/api/v1/carnetizacion/plantillas-motor/{borrador.id}/vista-previa/', {}, format='json')

    assert respuesta.status_code == 200, respuesta.data
    caras = respuesta.data['data']
    assert _color_dominante(caras['anverso']) == (255, 0, 0)
    assert _color_dominante(caras['reverso']) == (0, 0, 255)


def test_vista_previa_de_cambios_sin_guardar(api, borrador):
    respuesta = api.post(
        f'/api/v1/carnetizacion/plantillas-motor/{borrador.id}/vista-previa/',
        {'definicion': _definicion('#00ff00', '#ffffff')},
        format='json',
    )

    assert respuesta.status_code == 200
    assert _color_dominante(respuesta.data['data']['anverso']) == (0, 255, 0)
    # Lo guardado no cambia: solo se previsualizó.
    borrador.refresh_from_db()
    assert borrador.definicion['bg']['anverso'] == ROJO


def test_vista_previa_de_plantilla_inexistente_o_definicion_invalida(api, borrador):
    url = '/api/v1/carnetizacion/plantillas-motor/{}/vista-previa/'
    assert api.post(url.format('01a1fa61-0000-7000-8000-000000000000'), {}, format='json').status_code == 404
    assert api.post(url.format(borrador.id), {'definicion': 'nada'}, format='json').status_code == 400


def test_la_consola_recibe_el_reverso_real_de_la_plantilla(api, borrador, monkeypatch):
    monkeypatch.setattr(comun_mod, 'condicion_titular', lambda empleado: 'ACTIVO')
    borrador.estado, borrador.activa = 'publicada', True
    borrador.save()
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'V'})
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='F')
    EmployeeModel.objects.create(cedulaidentidad='7730001', nombres='ANA', apellidos='PREVIA', sexoid=sexo,
                                 nacionalidad_id=1)

    respuesta = api.post('/api/v1/carnetizacion/actualizar-vista-previa/7730001/', {'nombre': 'ANA PREVIA'}, format='json')

    assert respuesta.status_code == 200, respuesta.data
    datos = respuesta.data['data']
    assert _color_dominante(datos['vista_previa']) == (255, 0, 0)
    assert _color_dominante(datos['vista_previa_reverso']) == (0, 0, 255)
