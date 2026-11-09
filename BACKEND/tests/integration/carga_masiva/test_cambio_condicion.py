"""FIX-CARGA1: cambio de condición activo→pasivo y pasivo→activo.

Las pruebas usan la plantilla real (openpyxl), el análisis real y la aplicación
real contra la base de datos. Comprueban que sin confirmar la fila no se aplica
y que la reversión compensa el movimiento.
"""
import datetime
import io

import pytest
from openpyxl import load_workbook
from rest_framework.test import APIClient

from apps.carga_masiva.infrastructure.analisis import analizar_archivo
from apps.carga_masiva.infrastructure.aplicacion import (
    aplicar_carga,
    confirmar_filas,
    revertir_carga,
)
from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel, CargaMasivaModel
from apps.carga_masiva.infrastructure.plantilla_excel import generar_plantilla
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    CategoriaMovimientoModel,
    EstadoCivilModel,
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.movimientos.infrastructure.models.movimiento_models import (
    EmployeeMovementHistoryModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def escenario():
    SexoModel.objects.create(sexo='MASCULINO')
    nacionalidad = NacionalidadModel.objects.create(codigo='V', nombre='VENEZOLANO')
    EstadoCivilModel.objects.create(estadoCivil='SOLTERO')
    estatus_activo = EstatusModel.objects.create(estatus='ACTIVO')
    estatus_vacante = EstatusModel.objects.create(estatus='VACANTE')
    EstatusModel.objects.create(estatus='EGRESADO')
    tipo_activo = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    tipo_pasivo = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    nomina_activa = TipoNominaModel.objects.create(nomina='OBREROS', es_activo=True)
    nomina_pasiva = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)
    cat_pase = CategoriaMovimientoModel.objects.create(categoria='PASE A PASIVO')
    cat_ingreso = CategoriaMovimientoModel.objects.create(categoria='INGRESO')
    motivo_pase = TipoMovimientoModel.objects.create(
        movimiento='JUBILACION DE DERECHO', categoria=cat_pase, activo=True,
    )
    motivo_ingreso = TipoMovimientoModel.objects.create(
        movimiento='REINGRESO', categoria=cat_ingreso, activo=True,
    )
    denominacion = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    especifica = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dependencia = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    direccion = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='GESTION HUMANA', dependenciaId=dependencia,
    )
    direccion_pasivos = DireccionGeneralModel.objects.create(
        Codigo='DG2', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dependencia,
    )
    actor = EmployeeModel.objects.create(
        cedulaidentidad='77000000',
        nombres='ACTOR',
        apellidos='PRUEBA',
        fecha_nacimiento=datetime.date(1980, 1, 1),
        sexoid=SexoModel.objects.first(),
        nacionalidad=nacionalidad,
        total_anos_apn=0,
    )
    rol = RolModel.objects.create(nombre_rol='ANALISTA RRHH', nombre_visible='Analista RRHH')
    cuenta = CuentaModel.objects.create(cedula=actor, rol=rol, password='!')
    return {
        'nacionalidad': nacionalidad,
        'cuenta': cuenta,
        'estatus_activo': estatus_activo,
        'estatus_vacante': estatus_vacante,
        'tipo_activo': tipo_activo,
        'tipo_pasivo': tipo_pasivo,
        'nomina_activa': nomina_activa,
        'nomina_pasiva': nomina_pasiva,
        'motivo_pase': motivo_pase,
        'motivo_ingreso': motivo_ingreso,
        'denominacion': denominacion,
        'especifica': especifica,
        'dependencia': dependencia,
        'direccion': direccion,
        'direccion_pasivos': direccion_pasivos,
    }


def _empleado(cedula: str, escenario) -> EmployeeModel:
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula,
        nombres='ANA',
        apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1),
        sexoid=SexoModel.objects.first(),
        nacionalidad=escenario['nacionalidad'],
        total_anos_apn=0,
    )


def _cargo(codigo, escenario, tipo_personal, estatus, empleado=None):
    return AsigTrabajoModel.objects.create(
        codigo=codigo,
        employee=empleado,
        denominacioncargoid=escenario['denominacion'],
        denominacioncargoespecificoid=escenario['especifica'],
        tiponominaid=escenario['nomina_pasiva'] if tipo_personal == escenario['tipo_pasivo'] else escenario['nomina_activa'],
        estatusid=estatus,
        Tipo_personal=tipo_personal,
        Dependencia=escenario['dependencia'],
        DireccionGeneral=escenario['direccion'],
    )


def _llenar(contenido: bytes, hoja_nombre: str, valores: dict) -> bytes:
    libro = load_workbook(io.BytesIO(contenido))
    hoja = libro[hoja_nombre]
    for indice in range(1, hoja.max_column + 1):
        etiqueta = str(hoja.cell(row=3, column=indice).value or '').replace('*', '').strip()
        if etiqueta in valores:
            hoja.cell(row=5, column=indice, value=valores[etiqueta])
    salida = io.BytesIO()
    libro.save(salida)
    return salida.getvalue()


def _carga(poblacion: str, tipos: list[str], archivo='condicion.xlsx'):
    return CargaMasivaModel.objects.create(
        archivo_nombre=archivo,
        poblacion=poblacion,
        tipos=tipos,
        solicitada_por_cedula='1',
        estado=CargaMasivaModel.Estado.ANALIZADA,
    )


def test_activo_a_pasivo_requiere_confirmacion_y_revierte(escenario):
    empleado = _empleado('77000001', escenario)
    _cargo('P-100', escenario, escenario['tipo_activo'], escenario['estatus_activo'], empleado)
    contenido = generar_plantilla(['datos_personales'], 'obligatorios', 'PASIVOS')
    contenido = _llenar(contenido, 'Datos personales', {
        'Cédula': '77000001',
        'Nombres': 'ANA',
        'Apellidos': 'PEREZ',
        'Sexo': 'MASCULINO',
        'Fecha de nacimiento': '1990-01-01',
        'Nacionalidad': 'VENEZOLANO',
        'Estado civil': 'SOLTERO',
        'Fecha de egreso': '2026-06-30',
        'Motivo del pase a pasivo': 'JUBILACION DE DERECHO',
        'Tipo de nómina de pasivo': 'JUBILADO',
    })

    carga = _carga('PASIVOS', ['datos_personales'])
    analizar_archivo(carga, contenido, ['datos_personales'])
    fila = carga.filas.get()
    assert fila.estado == 'REQUIERE_CONFIRMACION'
    assert fila.movimiento['tipo'] == 'ACTIVO_A_PASIVO'
    assert fila.movimiento['completo'] is True
    assert fila.movimiento['motivo'] == 'JUBILACION DE DERECHO'
    assert carga.filas_confirmacion == 1

    # Sin confirmar no se aplica ni cambia la condición.
    aplicar_carga(carga, '1', escenario['cuenta'].pk)
    assert RepoCondicionTrabajadorORM().condicion_por_cedula('77000001') is CondicionTrabajador.ACTIVO
    assert not AsigTrabajoModel.objects.filter(
        employee_id='77000001', Tipo_personal__tipo_personal='PASIVO',
    ).exists()

    # Confirmada, aplica por el flujo de pasivos y deja el historial.
    # La UI impide aplicar sin confirmar; en la prueba se devuelve la carga a
    # ANALIZADA para reutilizar el mismo archivo tras comprobar el bloqueo.
    carga.estado = CargaMasivaModel.Estado.ANALIZADA
    carga.save(update_fields=['estado'])
    confirmar_filas(carga, [str(fila.id)], '1', escenario['cuenta'].pk)
    aplicar_carga(carga, '1', escenario['cuenta'].pk)
    fila.refresh_from_db()
    assert not fila.error_aplicacion, fila.error_aplicacion
    assert fila.aplicada is True
    assert RepoCondicionTrabajadorORM().condicion_por_cedula('77000001') is CondicionTrabajador.PASIVO
    pasivo = AsigTrabajoModel.objects.get(
        employee_id='77000001', Tipo_personal__tipo_personal='PASIVO',
    )
    assert pasivo.tiponominaid_id == escenario['nomina_pasiva'].pk
    assert EmployeeEgresadoModel.objects.filter(employee_id='77000001').exists()
    assert EmployeeMovementHistoryModel.objects.filter(
        empleado=empleado, tipo_movimiento='EGRESO',
    ).exists()

    # Revertir compensa el movimiento y devuelve la condición ACTIVO.
    revertir_carga(carga)
    assert RepoCondicionTrabajadorORM().condicion_por_cedula('77000001') is CondicionTrabajador.ACTIVO
    assert not AsigTrabajoModel.objects.filter(
        employee_id='77000001', Tipo_personal__tipo_personal='PASIVO',
    ).exists()
    assert not EmployeeEgresadoModel.objects.filter(employee_id='77000001').exists()
    assert AsigTrabajoModel.objects.get(codigo='P-100').employee_id == '77000001'


def test_pasivo_a_activo_requiere_confirmacion_y_revierte(escenario):
    empleado = _empleado('77000002', escenario)
    pasivo = _cargo('X-100', escenario, escenario['tipo_pasivo'], escenario['estatus_activo'], empleado)
    vacante = _cargo('A-200', escenario, escenario['tipo_activo'], escenario['estatus_vacante'])
    contenido = generar_plantilla(['cargo_asignacion'], 'obligatorios', 'ACTIVOS')
    contenido = _llenar(contenido, 'Cargo y asignación', {
        'Cédula': '77000002',
        'Denominación del cargo': 'ANALISTA',
        'Denominación específica': 'ANALISTA I',
        'Nivel / Dependencia': 'CONATEL',
        'Dirección / Gerencia / Oficina': 'GESTION HUMANA',
        'Tipo de nómina': 'OBREROS',
        'Fecha de ingreso o reingreso': '2026-07-01',
        'Motivo del ingreso o reingreso': 'REINGRESO',
    })

    carga = _carga('ACTIVOS', ['cargo_asignacion'])
    analizar_archivo(carga, contenido, ['cargo_asignacion'])
    fila = carga.filas.get()
    assert fila.estado == 'REQUIERE_CONFIRMACION'
    assert fila.movimiento['tipo'] == 'PASIVO_A_ACTIVO'
    assert fila.movimiento['completo'] is True
    codigo_previsto = fila.movimiento['cargo_codigo']
    assert codigo_previsto

    aplicar_carga(carga, '1', 1)
    assert RepoCondicionTrabajadorORM().condicion_por_cedula('77000002') is CondicionTrabajador.PASIVO
    assert AsigTrabajoModel.objects.get(pk=vacante.pk).employee_id is None

    carga.estado = CargaMasivaModel.Estado.ANALIZADA
    carga.save(update_fields=['estado'])
    confirmar_filas(carga, [str(fila.id)], '1', escenario['cuenta'].pk)
    aplicar_carga(carga, '1', escenario['cuenta'].pk)
    fila.refresh_from_db()
    assert not fila.error_aplicacion, fila.error_aplicacion
    assert fila.aplicada is True
    assert RepoCondicionTrabajadorORM().condicion_por_cedula('77000002') is CondicionTrabajador.ACTIVO
    creado = AsigTrabajoModel.objects.get(employee_id='77000002')
    assert creado.codigo == codigo_previsto
    assert creado.denominacioncargoid.cargo == 'ANALISTA'
    assert AsigTrabajoModel.objects.get(pk=vacante.pk).employee_id is None
    assert AsigTrabajoModel.objects.get(pk=pasivo.pk).employee_id is None
    assert EmployeeMovementHistoryModel.objects.filter(
        empleado=empleado, tipo_movimiento='INGRESO',
    ).exists()

    revertir_carga(carga)
    assert RepoCondicionTrabajadorORM().condicion_por_cedula('77000002') is CondicionTrabajador.PASIVO
    assert AsigTrabajoModel.objects.get(pk=pasivo.pk).employee_id == '77000002'
    assert not AsigTrabajoModel.objects.filter(codigo=codigo_previsto).exists()
    assert AsigTrabajoModel.objects.get(pk=vacante.pk).employee_id is None


def test_carga_pasivos_no_admite_cargo_y_asignacion():
    from core.domain.exceptions import ValidationError

    with pytest.raises(ValidationError):
        generar_plantilla(['cargo_asignacion'], 'obligatorios', 'PASIVOS')


def test_confirmar_fila_sin_movimiento_completo_falla(escenario):
    empleado = _empleado('77000003', escenario)
    _cargo('P-300', escenario, escenario['tipo_activo'], escenario['estatus_activo'], empleado)
    contenido = generar_plantilla(['datos_personales'], 'obligatorios', 'PASIVOS')
    contenido = _llenar(contenido, 'Datos personales', {
        'Cédula': '77000003',
        'Nombres': 'ANA',
        'Apellidos': 'PEREZ',
        'Sexo': 'MASCULINO',
        'Fecha de nacimiento': '1990-01-01',
        'Nacionalidad': 'VENEZOLANO',
        'Estado civil': 'SOLTERO',
    })
    carga = _carga('PASIVOS', ['datos_personales'])
    analizar_archivo(carga, contenido, ['datos_personales'])
    fila = carga.filas.get()
    assert fila.estado == 'REQUIERE_CONFIRMACION'
    assert fila.movimiento['completo'] is False
    with pytest.raises(Exception):
        confirmar_filas(carga, [str(fila.id)], '1', 1)


class _Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = '1', 1, 1, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(permisos):
    cliente = APIClient()
    cliente.force_authenticate(user=_Usuario(permisos))
    return cliente


def test_endpoint_confirma_filas_y_valida_permiso_de_poblacion():
    carga = _carga('PASIVOS', ['datos_personales'])
    fila = CargaMasivaFilaModel.objects.create(
        carga=carga,
        hoja='Datos personales',
        tipo='datos_personales',
        numero_fila=5,
        estado='REQUIERE_CONFIRMACION',
        datos={'cedula': '77000009'},
        movimiento={
            'tipo': 'ACTIVO_A_PASIVO',
            'condicion_actual': 'ACTIVO',
            'condicion_nueva': 'PASIVO',
            'completo': True,
            'faltantes': [],
        },
    )
    url = f'/api/v1/carga-masiva/cargas/{carga.id}/confirmar/'
    assert _cliente({'personal.carga_masiva'}).post(
        url, {'filas': [str(fila.id)]}, format='json',
    ).status_code == 403

    r = _cliente({'pasivos.carga_masiva'}).post(
        url, {'filas': [str(fila.id)]}, format='json',
    )
    assert r.status_code == 200, r.content
    fila.refresh_from_db()
    assert fila.confirmada is True
    assert fila.confirmada_por_cedula == '1'
    assert r.json()['data']['filas_confirmadas'] == 1

