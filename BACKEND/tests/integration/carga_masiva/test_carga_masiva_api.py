"""F2/F4: subida, análisis, resultados, aplicación y reversión de la carga masiva."""
import io

import pytest
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework.test import APIClient

from apps.carga_masiva.infrastructure.plantilla_excel import generar_plantilla
from apps.carga_masiva.infrastructure.aplicacion import aplicar_carga, revertir_carga
from apps.carga_masiva.infrastructure.analisis import analizar_archivo
from apps.carga_masiva.infrastructure.models import CargaMasivaModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    NacionalidadModel,
    SexoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

BASE = '/api/v1/carga-masiva'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = '1', 1, 1, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(permisos=None):
    c = APIClient()
    c.force_authenticate(user=Usuario({'personal.carga_masiva', 'personal.carga_masiva_revertir'} if permisos is None else permisos))
    return c


@pytest.fixture
def catalogos(db):
    SexoModel.objects.create(sexo='FEMENINO')
    SexoModel.objects.create(sexo='MASCULINO')
    NacionalidadModel.objects.create(codigo='V', nombre='VENEZOLANO')
    EstadoCivilModel.objects.create(estadoCivil='SOLTERO')


def _archivo(cedula='8000001', nombres='ANA'):
    contenido = generar_plantilla(['datos_personales'], 'obligatorios')
    libro = load_workbook(io.BytesIO(contenido))
    hoja = libro['Datos personales']
    fila = 5
    valores = {
        'cedula': cedula, 'nombres': nombres, 'apellidos': 'PRUEBA',
        'sexo_id': 'FEMENINO', 'nacionalidad_id': 'VENEZOLANO',
        'estado_civil_id': 'SOLTERO', 'fecha_nacimiento': '1990-01-01',
    }
    for col in range(1, hoja.max_column + 1):
        etiqueta = str(hoja.cell(row=3, column=col).value or '').replace('*', '').strip()
        clave = {
            'Cédula': 'cedula', 'Nombres': 'nombres', 'Apellidos': 'apellidos',
            'Sexo': 'sexo_id', 'Nacionalidad': 'nacionalidad_id',
            'Estado civil': 'estado_civil_id',
            'Fecha de nacimiento': 'fecha_nacimiento',
        }.get(etiqueta)
        if clave and clave in valores:
            hoja.cell(row=fila, column=col, value=valores[clave])
    salida = io.BytesIO()
    libro.save(salida)
    return salida.getvalue()


def test_analiza_nuevo_actualiza_y_reporta_errores(catalogos):
    contenido = _archivo()
    carga = CargaMasivaModel.objects.create(
        archivo_nombre='carga.xlsx', tipos=['datos_personales'], solicitada_por_cedula='1',
    )
    analizar_archivo(carga, contenido, ['datos_personales'])
    carga.refresh_from_db()
    assert carga.estado == CargaMasivaModel.Estado.ANALIZADA
    assert (carga.filas_total, carga.filas_validas, carga.filas_error) == (1, 1, 0)
    assert carga.filas.get().estado == 'NUEVO'


def test_api_sube_analiza_lista_y_descarga_resultados(catalogos):
    archivo = io.BytesIO(_archivo())
    archivo.name = 'carga.xlsx'
    r = cliente().post(f'{BASE}/cargas/', {'archivo': archivo, 'poblacion': 'ACTIVOS', 'tipos': 'datos_personales'}, format='multipart')
    assert r.status_code == 202, r.content
    carga_id = r.json()['data']['id']
    detalle = cliente().get(f'{BASE}/cargas/{carga_id}/')
    assert detalle.status_code == 200 and detalle.json()['data']['filas_total'] == 1
    resultados = cliente().get(f'{BASE}/cargas/{carga_id}/resultados/')
    assert resultados.status_code == 200
    libro = load_workbook(io.BytesIO(resultados.content))
    hoja = libro['Resultados']
    assert hoja['A2'].value == 'ACTIVOS'
    assert hoja['E2'].value == 'NUEVO'
    assert cliente(set()).post(f'{BASE}/cargas/', {'poblacion': 'ACTIVOS'}, format='multipart').status_code == 403


def test_aplica_y_revierte_datos_personales(catalogos):
    contenido = _archivo()
    carga = CargaMasivaModel.objects.create(
        archivo_nombre='carga.xlsx', tipos=['datos_personales'], solicitada_por_cedula='1',
    )
    analizar_archivo(carga, contenido, ['datos_personales'])
    aplicar_carga(carga, '1')
    carga.refresh_from_db()
    assert carga.estado == CargaMasivaModel.Estado.APLICADA
    empleado = EmployeeModel.objects.get(cedulaidentidad='8000001')
    assert empleado.nombres == 'ANA' and empleado.apellidos == 'PRUEBA'
    revertir_carga(carga)
    carga.refresh_from_db()
    assert carga.estado == CargaMasivaModel.Estado.REVERTIDA
    assert not EmployeeModel.objects.filter(cedulaidentidad='8000001').exists()


def test_solo_xlsx_y_tamano(catalogos):
    archivo = io.BytesIO(b'no soy excel')
    archivo.name = 'carga.csv'
    assert cliente().post(f'{BASE}/cargas/', {'archivo': archivo, 'poblacion': 'ACTIVOS'}, format='multipart').status_code == 400


def test_subida_exige_poblacion(catalogos):
    archivo = io.BytesIO(_archivo())
    archivo.name = 'carga.xlsx'
    r = cliente().post(f'{BASE}/cargas/', {'archivo': archivo}, format='multipart')
    assert r.status_code == 400
    assert 'poblacion' in r.json()['data']['errores']


def test_permiso_de_poblacion_es_separado(catalogos):
    archivo = io.BytesIO(_archivo())
    archivo.name = 'carga.xlsx'
    solo_pasivos = cliente({'pasivos.carga_masiva'})
    assert solo_pasivos.post(
        f'{BASE}/cargas/', {'archivo': archivo, 'poblacion': 'ACTIVOS'}, format='multipart',
    ).status_code == 403
    archivo.seek(0)
    assert solo_pasivos.post(
        f'{BASE}/cargas/', {'archivo': archivo, 'poblacion': 'PASIVOS'}, format='multipart',
    ).status_code == 202


def test_historial_guarda_y_filtra_la_poblacion(catalogos):
    CargaMasivaModel.objects.create(
        archivo_nombre='activos.xlsx', poblacion='ACTIVOS', tipos=['datos_personales'],
        solicitada_por_cedula='1', estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    CargaMasivaModel.objects.create(
        archivo_nombre='pasivos.xlsx', poblacion='PASIVOS', tipos=['datos_personales'],
        solicitada_por_cedula='1', estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    r = cliente({'personal.carga_masiva', 'pasivos.carga_masiva'}).get(f'{BASE}/cargas/')
    assert r.status_code == 200
    poblaciones = {c['poblacion'] for c in r.json()['data']}
    assert poblaciones == {'ACTIVOS', 'PASIVOS'}
    solo_pasivos = cliente({'personal.carga_masiva', 'pasivos.carga_masiva'}).get(
        f'{BASE}/cargas/?poblacion=PASIVOS',
    ).json()['data']
    assert [c['archivo'] for c in solo_pasivos] == ['pasivos.xlsx']
    solo_activos = cliente({'personal.carga_masiva'}).get(f'{BASE}/cargas/').json()['data']
    assert [c['archivo'] for c in solo_activos] == ['activos.xlsx']
