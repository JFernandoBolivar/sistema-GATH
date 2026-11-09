"""F1: registro de campos y generador de la plantilla de carga masiva."""
import io

import pytest
from openpyxl import load_workbook
from rest_framework.test import APIClient

from apps.carga_masiva.infrastructure.plantilla_excel import generar_plantilla
from apps.carga_masiva.domain.registro_campos import TIPOS_CARGA, TIPOS_POR_CLAVE
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    EstatusModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
    TipoNominaModel,
)
from core.domain.exceptions import ValidationError

BASE = '/api/v1/carga-masiva'
PERMISO = 'personal.carga_masiva'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = '1', 1, 1, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(permisos=None):
    c = APIClient()
    c.force_authenticate(user=Usuario({PERMISO} if permisos is None else permisos))
    return c


@pytest.fixture
def catalogos(db):
    SexoModel.objects.create(sexo='FEMENINO')
    SexoModel.objects.create(sexo='MASCULINO')
    NacionalidadModel.objects.create(codigo='V', nombre='VENEZOLANO')
    EstadoCivilModel.objects.create(estadoCivil='SOLTERO')
    TipoNominaModel.objects.create(nomina='OBREROS', es_activo=True)
    EstatusModel.objects.create(estatus='ACTIVO')
    ParentescoModel.objects.create(id=1, descripcion_parentesco='HIJO (A)', aplica_familiar=True)
    ParentescoModel.objects.create(id=2, descripcion_parentesco='AMIGO', aplica_familiar=False)


def test_registro_cubre_los_nueve_tipos_y_sus_claves_de_negocio():
    assert len(TIPOS_CARGA) == 9
    assert set(TIPOS_POR_CLAVE) == {
        'datos_personales', 'cargo_asignacion', 'familiares', 'contactos_emergencia',
        'formacion_academica', 'formacion_complementaria', 'vivienda', 'salud_tallas',
        'antecedentes_laborales',
    }
    assert TIPOS_POR_CLAVE['familiares'].campo('orden_hijo') is not None
    assert TIPOS_POR_CLAVE['familiares'].campo('cedula_familiar').obligatorio is False


def test_plantilla_tiene_hojas_encabezados_catalogos_y_ejemplo(catalogos):
    contenido = generar_plantilla(['datos_personales', 'familiares'], 'obligatorios')
    libro = load_workbook(io.BytesIO(contenido))
    assert libro.sheetnames[0] == 'Instrucciones'
    assert 'Datos personales' in libro.sheetnames
    assert 'Familiares' in libro.sheetnames
    assert libro['Catalogos'].sheet_state == 'hidden'

    hoja = libro['Datos personales']
    encabezados = [hoja.cell(row=3, column=c).value for c in range(1, 11)]
    assert encabezados[0] == 'Cédula *' and encabezados[2] == 'Apellidos *'
    assert hoja.cell(row=4, column=1).value == '12345678'
    assert hoja.freeze_panes == 'A5'
    assert len(hoja.data_validations.dataValidation) >= 2
    assert hoja['A3'].comment is not None

    catalogo = libro['Catalogos']
    columna_sexo = next(
        col for col in range(1, catalogo.max_column + 1)
        if catalogo.cell(row=1, column=col).value == 'sexo'
    )
    valores_sexo = [catalogo.cell(row=fila, column=columna_sexo).value for fila in range(2, 5)]
    assert 'FEMENINO' in valores_sexo

    hoja_fam = libro['Familiares']
    etiquetas = [hoja_fam.cell(row=3, column=c).value for c in range(1, 9)]
    assert 'Cédula del familiar' in etiquetas and 'Orden del hijo' in etiquetas
    assert 'HIJO (A)' in [
        libro['Catalogos'].cell(row=fila, column=col).value
        for fila in range(2, 5) for col in range(1, 6)
    ]


def test_plantilla_completa_y_validaciones_de_entrada(catalogos):
    with pytest.raises(ValidationError):
        generar_plantilla(['inexistente'], 'obligatorios')
    with pytest.raises(ValidationError):
        generar_plantilla(None, 'otro')
    contenido = generar_plantilla(None, 'completo')
    libro = load_workbook(io.BytesIO(contenido))
    # Instrucciones + Catalogos + hojas ocultas (código postal + jerarquía de
    # cargo) + 9 tipos de carga.
    assert len(libro.sheetnames) == 16


def test_endpoint_descarga_la_plantilla_y_exige_permiso(catalogos):
    r = cliente().get(f'{BASE}/plantilla/?tipos=datos_personales&modo=obligatorios')
    assert r.status_code == 200
    assert r['Content-Type'].startswith('application/vnd.openxmlformats')
    assert r.content.startswith(b'PK')
    assert cliente(set()).get(f'{BASE}/plantilla/').status_code == 403
    assert APIClient().get(f'{BASE}/plantilla/').status_code in (401, 403)
    assert cliente().get(f'{BASE}/plantilla/?tipos=malo').status_code == 400


def test_plantilla_depende_de_la_poblacion(catalogos):
    activos = load_workbook(io.BytesIO(
        generar_plantilla(None, 'obligatorios', 'ACTIVOS'),
    ))
    pasivos = load_workbook(io.BytesIO(
        generar_plantilla(None, 'obligatorios', 'PASIVOS'),
    ))
    assert 'Cargo y asignación' in activos.sheetnames
    assert 'Cargo y asignación' not in pasivos.sheetnames
    encabezados_pasivos = [
        pasivos['Datos personales'].cell(row=3, column=col).value
        for col in range(1, pasivos['Datos personales'].max_column + 1)
    ]
    assert 'Fecha de egreso' in encabezados_pasivos
    assert 'Motivo del pase a pasivo' in encabezados_pasivos
    assert 'Tipo de nómina de pasivo' in encabezados_pasivos
    assert 'Motivo del pase a pasivo' not in [
        activos['Datos personales'].cell(row=3, column=col).value
        for col in range(1, activos['Datos personales'].max_column + 1)
    ]

def test_plantilla_cargo_trae_columnas_nuevas_y_listas_dependientes(catalogos):
    """FIX-CARGA4: se crea el cargo; no se pide un código existente."""
    libro = load_workbook(io.BytesIO(
        generar_plantilla(['cargo_asignacion'], 'obligatorios', 'ACTIVOS'),
    ))
    hoja = libro['Cargo y asignaci\u00f3n']
    encabezados = [str(c.value) for c in hoja[3] if c.value]
    assert any('Denominaci\u00f3n del cargo' in e for e in encabezados)
    assert any('Nivel / Dependencia' in e for e in encabezados)
    assert any('Direcci\u00f3n / Gerencia / Oficina' in e for e in encabezados)
    assert not any('C\u00f3digo de cargo' in e for e in encabezados)
    assert {'NivelesDirecciones', 'DireccionesLineas', 'LineasCoordinaciones'} <= set(libro.sheetnames)
