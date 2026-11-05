"""Integración (BD de pruebas) de las estadísticas de fe de vida (O21).

Cubre KPIs, desgloses por tipo/estado/canal, matriz, filtros, permisos,
listados paginados y la generación real de los archivos PDF y Excel.
"""
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
from apps.fe_de_vida.domain.value_objects.estados import EstadoProceso
from apps.fe_de_vida.infrastructure.exportacion_estadisticas import (
    generar_archivo_estadisticas,
    validar_parametros,
)
from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel
from apps.fe_de_vida.infrastructure.models.solicitud_models import SolicitudFeDeVidaModel
from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

BASE = '/api/v1/fe-de-vida'
VALIDADA, EN_REVISION, BORRADOR, SIN_SOLICITUD, ACTIVO = '7100001', '7100002', '7100003', '7100004', '7100005'
JUBILADO, PENSIONADO = '7100006', '7100007'
ANALISTA = '7200001'
PERMISO = 'fe_de_vida.ver_estadisticas'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula, permisos, pk):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = cedula, pk, pk, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(permisos):
    c = APIClient()
    c.force_authenticate(user=Usuario(ANALISTA, permisos, 1))
    return c


class ColaFalsa:
    def encolar(self, nombre_tarea, **kwargs):
        return 'tarea-estadisticas'


@pytest.fixture(autouse=True)
def cola(monkeypatch):
    monkeypatch.setattr(
        'apps.exportaciones.presentation.solicitud.CeleryTaskQueue', lambda: ColaFalsa(),
    )


@pytest.fixture
def datos(db):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    sexo = SexoModel.objects.create(sexo='F')
    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    pasivo = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    activo = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    nomina_jubilado = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)
    nomina_pensionado = TipoNominaModel.objects.create(nomina='PENSIONADO', es_activo=False)
    TipoNominaModel.objects.create(nomina='OBREROS', es_activo=True)
    dc = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    dce = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')

    filas = (
        (VALIDADA, 'ANA', 'ALVAREZ', nomina_jubilado, pasivo, f'{VALIDADA}@correo.test', '04141111111'),
        (EN_REVISION, 'BETO', 'BLANCO', nomina_jubilado, pasivo, f'{EN_REVISION}@correo.test', '04142222222'),
        (BORRADOR, 'CARLA', 'CASTRO', nomina_pensionado, pasivo, '', '04143333333'),
        (SIN_SOLICITUD, 'DIEGO', 'DIAZ', nomina_pensionado, pasivo, '', ''),
        (ACTIVO, 'ELENA', 'ESTRADA', nomina_jubilado, activo, '', '04145555555'),
    )
    for cedula, nombres, apellidos, nomina, tipo, correo, movil in filas:
        empleado = EmployeeModel.objects.create(
            cedulaidentidad=cedula, nombres=nombres, apellidos=apellidos, sexoid=sexo,
            correo=correo or None, telefono_movil=movil or None,
        )
        AsigTrabajoModel.objects.create(
            employee=empleado, codigo=f'C-{cedula}', denominacioncargoid=dc, denominacioncargoespecificoid=dce,
            tiponominaid=nomina, estatusid=estatus, Tipo_personal=tipo,
        )
    DatosComplementariosTrabajadorModel.objects.create(
        cedula=SIN_SOLICITUD, correo_alternativo='alt@correo.test',
    )

    ahora = timezone.now()
    proceso = ProcesoFeDeVidaModel.objects.create(
        nombre='Fe de vida 2026', fecha_apertura=ahora - timedelta(days=10),
        fecha_cierre=ahora + timedelta(days=20), estado=EstadoProceso.ABIERTO.value,
    )
    SolicitudFeDeVidaModel.objects.create(
        proceso=proceso, cedula=VALIDADA, estado='VALIDADA', fecha_envio=ahora,
        fecha_validacion=ahora, canal='EN_LINEA',
    )
    SolicitudFeDeVidaModel.objects.create(
        proceso=proceso, cedula=EN_REVISION, estado='PENDIENTE_REVISION',
        fecha_envio=ahora - timedelta(days=2), canal='PRESENCIAL',
    )
    SolicitudFeDeVidaModel.objects.create(proceso=proceso, cedula=BORRADOR, estado='BORRADOR')
    return {'proceso': proceso, 'ahora': ahora, 'jubilado': nomina_jubilado, 'pensionado': nomina_pensionado}


def cuerpo(respuesta):
    return respuesta.json()['data']


def test_kpis_desgloses_y_matriz(datos):
    c = cliente({PERMISO})
    datos_api = cuerpo(c.get(f'{BASE}/estadisticas/'))
    assert datos_api['proceso']['id'] == str(datos['proceso'].id)
    kpis = datos_api['kpis']
    assert (kpis['total'], kpis['respondieron'], kpis['faltan'], kpis['validadas']) == (4, 2, 2, 1)
    assert kpis['porcentaje_respondieron'] == 50.0 and kpis['porcentaje_faltan'] == 50.0
    por_tipo = {f['tipo_nomina']: f for f in datos_api['por_tipo']}
    assert por_tipo['JUBILADO']['total'] == 2 and por_tipo['JUBILADO']['respondieron'] == 2
    assert por_tipo['PENSIONADO']['total'] == 2 and por_tipo['PENSIONADO']['faltan'] == 2
    assert {f['estado']: f['total'] for f in datos_api['por_estado']} == {
        'VALIDADA': 1, 'PENDIENTE_REVISION': 1, 'BORRADOR': 1,
    }
    # El canal solo cuenta solicitudes enviadas (el borrador no tiene canal de envío).
    assert {f['canal']: f['total'] for f in datos_api['por_canal']} == {'EN_LINEA': 1, 'PRESENCIAL': 1}
    matriz = {(f['tipo_nomina'], f['estado']): f['total'] for f in datos_api['matriz']}
    assert matriz[('JUBILADO', 'VALIDADA')] == 1 and matriz[('PENSIONADO', 'BORRADOR')] == 1
    assert {t['nombre'] for t in datos_api['tipos']} == {'JUBILADO', 'PENSIONADO'}
    assert len(datos_api['procesos']) == 1


def test_filtros_por_tipo_estado_canal_y_fechas(datos):
    c = cliente({PERMISO})
    por_tipo = cuerpo(c.get(f'{BASE}/estadisticas/?tipo_nomina_id={datos["pensionado"].id}'))
    assert por_tipo['kpis']['total'] == 2 and por_tipo['kpis']['respondieron'] == 0
    por_estado = cuerpo(c.get(f'{BASE}/estadisticas/?estado=VALIDADA'))
    assert por_estado['kpis']['total'] == 4 and [f['estado'] for f in por_estado['por_estado']] == ['VALIDADA']
    assert len(por_estado['matriz']) == 1
    por_canal = cuerpo(c.get(f'{BASE}/estadisticas/?canal=PRESENCIAL'))
    assert {f['canal']: f['total'] for f in por_canal['por_canal']} == {'PRESENCIAL': 1}
    assert [f['estado'] for f in por_canal['por_estado']] == ['PENDIENTE_REVISION']
    hoy = timezone.localtime().date().isoformat()
    desde_hoy = cuerpo(c.get(f'{BASE}/estadisticas/?desde={hoy}'))
    assert [f['estado'] for f in desde_hoy['por_estado']] == ['VALIDADA']
    assert c.get(f'{BASE}/estadisticas/?estado=INVENTADO').status_code == 400
    assert c.get(f'{BASE}/estadisticas/?desde=2026-12-31&hasta=2026-01-01').status_code == 400
    assert c.get(f'{BASE}/estadisticas/?proceso_id=no-es-uuid').status_code == 400


def test_proceso_cerrado_se_puede_consultar(datos):
    ahora = timezone.now()
    cerrado = ProcesoFeDeVidaModel.objects.create(
        nombre='Fe de vida 2025', fecha_apertura=ahora - timedelta(days=400),
        fecha_cierre=ahora - timedelta(days=300), estado=EstadoProceso.CERRADO.value,
    )
    SolicitudFeDeVidaModel.objects.create(
        proceso=cerrado, cedula=VALIDADA, estado='VALIDADA', fecha_envio=ahora - timedelta(days=350),
    )
    c = cliente({PERMISO})
    datos_api = cuerpo(c.get(f'{BASE}/estadisticas/?proceso_id={cerrado.id}'))
    assert datos_api['proceso']['estado'] == 'CERRADO'
    assert datos_api['kpis']['total'] == 4 and datos_api['kpis']['respondieron'] == 1
    assert len(datos_api['procesos']) == 2


def test_listado_de_faltantes_y_de_una_casilla(datos):
    c = cliente({PERMISO})
    faltantes = cuerpo(c.get(f'{BASE}/estadisticas/pasivos/?faltantes=true&limit=50'))
    assert faltantes['count'] == 2
    assert [f['cedula'] for f in faltantes['results']] == [BORRADOR, SIN_SOLICITUD]
    sin_solicitud = next(f for f in faltantes['results'] if f['cedula'] == SIN_SOLICITUD)
    assert sin_solicitud['correo'] == 'alt@correo.test' and sin_solicitud['telefono'] == ''
    jubilado = next(f for f in faltantes['results'] if f['cedula'] == BORRADOR)
    assert jubilado['tipo_nomina'] == 'PENSIONADO' and jubilado['telefono'] == '04143333333'

    casilla = cuerpo(c.get(
        f'{BASE}/estadisticas/pasivos/?estado=VALIDADA&tipo_nomina_id={datos["jubilado"].id}',
    ))
    assert casilla['count'] == 1 and casilla['results'][0]['cedula'] == VALIDADA
    assert casilla['results'][0]['canal'] == 'EN_LINEA' and casilla['results'][0]['fecha_envio']
    assert c.get(f'{BASE}/estadisticas/pasivos/').status_code == 400
    # Paginación del listado.
    assert len(cuerpo(c.get(f'{BASE}/estadisticas/pasivos/?faltantes=true&limit=1'))['results']) == 1


def test_permisos_estadisticas(datos):
    assert cliente(set()).get(f'{BASE}/estadisticas/').status_code == 403
    assert cliente({'fe_de_vida.ver_panel'}).get(f'{BASE}/estadisticas/').status_code == 403
    assert cliente({'fe_de_vida.ver_cobertura'}).get(f'{BASE}/estadisticas/').status_code == 403
    assert APIClient().get(f'{BASE}/estadisticas/').status_code in (401, 403)
    assert cliente({PERMISO}).get(f'{BASE}/estadisticas/').status_code == 200


def test_exportaciones_se_encolan_y_generan_pdf_y_excel(datos):
    from apps.exportaciones.infrastructure.generadores import GeneradorExportacionDjango
    from apps.exportaciones.infrastructure.models.trabajo_exportacion_model import TrabajoExportacionModel

    c = cliente({PERMISO})
    for formato in ('pdf', 'excel'):
        r = c.get(f'{BASE}/estadisticas/exportar/?formato={formato}&listado=faltantes')
        assert r.status_code == 202, r.content
        trabajo = TrabajoExportacionModel.objects.get(pk=cuerpo(r)['id'])
        assert trabajo.tipo == 'fe_de_vida_estadisticas' and trabajo.formato == formato

    parametros = {'filtros': {'listado': 'faltantes'}}
    validar_parametros(parametros)
    generador = GeneradorExportacionDjango()
    archivo_pdf = generador.generar('fe_de_vida_estadisticas', 'pdf', parametros, lambda _p: None)
    assert archivo_pdf.contenido.startswith(b'%PDF') and archivo_pdf.metadatos['total_encontrados'] == 2
    archivo_excel = generador.generar('fe_de_vida_estadisticas', 'excel', parametros, lambda _p: None)
    libro = load_workbook(filename=__import__('io').BytesIO(archivo_excel.contenido))
    assert libro.sheetnames == ['Resumen e indicadores', 'Listado de pasivos']
    resumen = libro['Resumen e indicadores']
    assert resumen['A1'].value == 'Estadísticas de fe de vida'
    assert resumen['A1'].font.bold is True
    assert resumen.freeze_panes == 'A5'
    assert any(
        str(celda.value).startswith('Total de pasivos')
        for fila in resumen.iter_rows() for celda in fila
    )
    hoja = libro['Listado de pasivos']
    assert hoja.auto_filter.ref is not None
    fila_cabecera = next(
        fila[0].row for fila in hoja.iter_rows() if fila and fila[0].value == 'Cédula'
    )
    cabecera = [celda.value for celda in hoja[fila_cabecera]]
    assert cabecera[:3] == ['Cédula', 'Nombre completo', 'Tipo de pasivo']
    assert hoja.freeze_panes == f'A{fila_cabecera + 1}'
    assert hoja['A1'].value == 'Estadísticas de fe de vida · Listado de pasivos'
    primera_cabecera = hoja.cell(row=fila_cabecera, column=1)
    assert primera_cabecera.fill.start_color.rgb.endswith('1A237E')
    assert primera_cabecera.font.color.rgb.endswith('FFFFFF')
    assert hoja.column_dimensions['B'].width and hoja.column_dimensions['B'].width <= 45
    if hoja.max_row > fila_cabecera + 2:
        assert hoja.cell(row=fila_cabecera + 2, column=1).fill.start_color.rgb.endswith('F4F6FB')

    celda = {'filtros': {'listado': 'celda', 'estado': 'VALIDADA'}}
    archivo_celda = generador.generar('fe_de_vida_estadisticas', 'pdf', celda, lambda _p: None)
    assert archivo_celda.contenido.startswith(b'%PDF')
    assert archivo_celda.metadatos['total_encontrados'] == 1


def test_validacion_de_parametros_de_exportacion(datos):
    with pytest.raises(ValidationError):
        validar_parametros({'filtros': {'listado': 'celda'}})
    with pytest.raises(ValidationError):
        validar_parametros({'filtros': {'listado': 'otro'}})
    with pytest.raises(ValidationError):
        validar_parametros({'filtros': {'desde': '2026-12-31', 'hasta': '2026-01-01'}})
