"""Integración de la exportación de la bandeja de fe de vida (O23)."""
import io
from datetime import timedelta

import pytest
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework.test import APIClient

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.exportaciones.infrastructure.generadores import GeneradorExportacionDjango
from apps.exportaciones.infrastructure.models.trabajo_exportacion_model import TrabajoExportacionModel
from apps.fe_de_vida.infrastructure.exportacion_bandeja import validar_parametros
from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel
from apps.fe_de_vida.infrastructure.models.solicitud_models import (
    ConstanciaFeDeVidaModel,
    SolicitudFeDeVidaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

BASE = '/api/v1/fe-de-vida'
VALIDA, REVISION, OPERADOR = '7300001', '7300002', '7300003'
ANALISTA = '7400001'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula, permisos, pk):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = cedula, pk, pk, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


class ColaFalsa:
    def encolar(self, nombre_tarea, **kwargs):
        return 'tarea-bandeja'


@pytest.fixture(autouse=True)
def cola(monkeypatch):
    monkeypatch.setattr(
        'apps.exportaciones.presentation.solicitud.CeleryTaskQueue', lambda: ColaFalsa(),
    )


def cliente(permisos=None):
    c = APIClient()
    c.force_authenticate(user=Usuario(
        ANALISTA, {'fe_de_vida.revisar'} if permisos is None else permisos, 1,
    ))
    return c


@pytest.fixture
def datos(db):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    sexo = SexoModel.objects.create(sexo='F')
    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    pasivo = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    nomina = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)
    dc = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    dce = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    for cedula, nombres, apellidos, correo, movil in (
        (VALIDA, 'ANA', 'ALVAREZ', 'ana@correo.test', '04141111111'),
        (REVISION, 'BETO', 'BLANCO', 'beto@correo.test', '04142222222'),
        (OPERADOR, 'CARLA', 'CASTRO', '', ''),
    ):
        empleado = EmployeeModel.objects.create(
            cedulaidentidad=cedula, nombres=nombres, apellidos=apellidos, sexoid=sexo,
            correo=correo or None, telefono_movil=movil or None,
        )
        AsigTrabajoModel.objects.create(
            employee=empleado, codigo=f'C-{cedula}', denominacioncargoid=dc, denominacioncargoespecificoid=dce,
            tiponominaid=nomina, estatusid=estatus, Tipo_personal=pasivo,
        )
    ahora = timezone.now()
    proceso = ProcesoFeDeVidaModel.objects.create(
        nombre='Fe de vida 2026', fecha_apertura=ahora - timedelta(days=10),
        fecha_cierre=ahora + timedelta(days=20), estado='ABIERTO',
    )
    validada = SolicitudFeDeVidaModel.objects.create(
        proceso=proceso, cedula=VALIDA, estado='VALIDADA', fecha_envio=ahora, canal='EN_LINEA',
    )
    SolicitudFeDeVidaModel.objects.create(
        proceso=proceso, cedula=REVISION, estado='PENDIENTE_REVISION',
        fecha_envio=ahora - timedelta(days=2), canal='PRESENCIAL',
    )
    ConstanciaFeDeVidaModel.objects.create(
        solicitud=validada, numero='FV-2026-000123', codigo_verificacion='c' * 64,
        certificada_por=[], plantilla_version=1, emitida_en=ahora,
    )
    return {'proceso': proceso, 'ahora': ahora}


def _parametros(filtros=None):
    return {'filtros': dict(filtros or {})}


def test_exportar_bandeja_se_encola_con_los_filtros(datos):
    c = cliente()
    r = c.get(f'{BASE}/solicitudes/exportar/?formato=pdf&estado=PENDIENTE_REVISION')
    assert r.status_code == 202, r.content
    trabajo = TrabajoExportacionModel.objects.get()
    assert trabajo.tipo == 'fe_de_vida_bandeja' and trabajo.formato == 'pdf'
    assert trabajo.parametros['filtros']['estado'] == 'PENDIENTE_REVISION'
    assert cliente({'fe_de_vida.ver_panel'}).get(f'{BASE}/solicitudes/exportar/?formato=excel').status_code == 202
    assert cliente(set()).get(f'{BASE}/solicitudes/exportar/?formato=excel').status_code == 403


def test_excel_bandeja_tiene_las_columnas_y_el_numero_de_acta(datos):
    generador = GeneradorExportacionDjango()
    archivo = generador.generar('fe_de_vida_bandeja', 'excel', _parametros(), lambda _p: None)
    libro = load_workbook(io.BytesIO(archivo.contenido))
    hoja = libro['Bandeja']
    fila_cabecera = next(
        fila[0].row for fila in hoja.iter_rows() if fila and fila[0].value == 'Cédula'
    )
    cabecera = [celda.value for celda in hoja[fila_cabecera]]
    assert cabecera == [
        'Cédula', 'Nombres', 'Apellidos', 'Correo', 'Teléfono', 'Estatus', 'Fecha de envío', 'Número de acta',
    ]
    assert 'numero_solicitud' not in [str(c).lower() for c in cabecera]
    filas = {
        hoja.cell(row=fila, column=1).value: [hoja.cell(row=fila, column=col).value for col in range(1, 9)]
        for fila in range(fila_cabecera + 1, fila_cabecera + 3)
    }
    assert filas[VALIDA][1:5] == ['ANA', 'ALVAREZ', 'ana@correo.test', '04141111111']
    assert filas[VALIDA][5] == 'Validada' and filas[VALIDA][7] == 'FV-2026-000123'
    assert filas[REVISION][1:5] == ['BETO', 'BLANCO', 'beto@correo.test', '04142222222']
    assert filas[REVISION][5] == 'En revisión' and filas[REVISION][7] in (None, '')
    assert hoja.auto_filter.ref is not None and hoja.freeze_panes == f'A{fila_cabecera + 1}'
    assert archivo.metadatos['total_encontrados'] == 2


def test_pdf_bandeja_y_filtros_de_texto_y_estado(datos):
    generador = GeneradorExportacionDjango()
    pdf = generador.generar('fe_de_vida_bandeja', 'pdf', _parametros(), lambda _p: None)
    assert pdf.contenido.startswith(b'%PDF') and pdf.metadatos['total_encontrados'] == 2
    solo_ana = generador.generar('fe_de_vida_bandeja', 'pdf', _parametros({'texto': 'ana'}), lambda _p: None)
    assert solo_ana.metadatos['total_encontrados'] == 1
    solo_validadas = generador.generar(
        'fe_de_vida_bandeja', 'excel', _parametros({'estado': 'VALIDADA'}), lambda _p: None,
    )
    assert solo_validadas.metadatos['total_encontrados'] == 1
    sin_resultados = generador.generar(
        'fe_de_vida_bandeja', 'excel', _parametros({'texto': 'inexistente'}), lambda _p: None,
    )
    assert sin_resultados.metadatos['total_encontrados'] == 0


def test_validacion_de_filtros_de_exportacion(datos):
    with pytest.raises(ValidationError):
        validar_parametros(_parametros({'estado': 'INVENTADO'}))
    with pytest.raises(ValidationError):
        validar_parametros(_parametros({'desde': '2026-12-31', 'hasta': '2026-01-01'}))
    with pytest.raises(ValidationError):
        validar_parametros(_parametros({'proceso_id': 'no-es-uuid'}))
