"""
Regresion de L2-06, L2-08 y L2-19 (cargos / prestamos de cargo) contra la BD
de pruebas. "Hoy" se controla parchando `timezone.localdate`.
"""
import datetime
from unittest.mock import patch

import pytest
from django.db import connection
from django.utils import timezone as dj_timezone

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.cargos.infrastructure.models.prestamo_models import PrestamoCargoModel
from apps.cargos.infrastructure.models.suspension_models import PrestamoCargoSuspensionModel
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.cargos.infrastructure.repositories.repo_prestamos_cargo_orm import RepoPrestamosCargoORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ConflictError

MOD = 'apps.cargos.infrastructure.repositories.repo_prestamos_cargo_orm'
D = datetime.date


def _estatus(nombre):
    return EstatusModel.objects.get_or_create(estatus=nombre)[0]


@pytest.fixture
def mundo(db):
    # Con --reuse-db la tabla nueva puede no existir aun: se crea dentro de la
    # transaccion del test (DDL transaccional en PostgreSQL).
    if PrestamoCargoSuspensionModel._meta.db_table not in connection.introspection.table_names():
        with connection.schema_editor() as editor:
            editor.create_model(PrestamoCargoSuspensionModel)
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANA'})
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    enc = EmployeeModel.objects.create(cedulaidentidad='V1', nombres='Enc', apellidos='Cargado', sexoid=sexo)
    otro = EmployeeModel.objects.create(cedulaidentidad='V2', nombres='Otro', apellidos='Persona', sexoid=sexo)
    den = DenominacionCargoModel.objects.create(cargo='DEN')
    esp = DenominacionCargoEspecificoModel.objects.create(cargo='ESP')
    nom = TipoNominaModel.objects.create(nomina='NOM')
    cuenta = CuentaModel.objects.create_user(cedula=otro, password='Clave*Segura1')
    # La tabla real tiene columnas NOT NULL que el modelo no declara.
    with connection.cursor() as cur:
        columnas = {c.name for c in connection.introspection.get_table_description(cur, 'Tipo_movimiento')}
        if 'activo' in columnas:
            cur.execute(
                'INSERT INTO "Tipo_movimiento" (movimiento, activo) VALUES (%s, true) RETURNING id',
                ['ENCARGADURIA'])
            motivo = TipoMovimientoModel.objects.get(pk=cur.fetchone()[0])
        else:
            motivo = None
    motivo = motivo or TipoMovimientoModel.objects.create(movimiento='ENCARGADURIA')
    activo, suspendido = _estatus('ACTIVO'), _estatus('SUSPENDIDO')
    vacante_estatus = _estatus('VACANTE')

    def cargo(codigo, empleado=None, estatus=activo):
        return AsigTrabajoModel.objects.create(
            codigo=codigo, employee=empleado, denominacioncargoid=den,
            denominacioncargoespecificoid=esp, tiponominaid=nom, estatusid=estatus,
        )

    return {
        'enc': enc, 'otro': otro, 'cuenta': cuenta, 'motivo': motivo, 'activo': activo,
        'suspendido': suspendido, 'vacante_estatus': vacante_estatus, 'cargo': cargo,
    }


@pytest.fixture
def hoy(mundo):
    """Hoy = 2026-11-10; sin eventos ni validacion de motivo (no son el objeto)."""
    with patch('django.utils.timezone.localdate', return_value=D(2026, 11, 10)), \
            patch(f'{MOD}.events'), \
            patch(f'{MOD}.obtener_motivo_de_operacion', return_value=mundo['motivo']):
        yield


def _crear(m, vacante, ini, fin):
    p = RepoPrestamosCargoORM().crear_prestamo(
        cedula_encargado='V1', cargo_id=vacante.pk, motivo_id=m['motivo'].pk,
        fecha_inicio=ini, fecha_fin=fin, usuario_id=m['cuenta'].pk,
    )
    # fecha_creacion es auto_now_add: se fija al "hoy" simulado.
    PrestamoCargoModel.objects.filter(pk=p.id).update(
        fecha_creacion=dj_timezone.make_aware(datetime.datetime(2026, 11, 10, 12, 0)))
    return p


def _est(c):
    return AsigTrabajoModel.objects.get(pk=c.pk).estatusid.estatus


def _est_prestamo(p):
    return PrestamoCargoModel.objects.get(pk=p.id).estatus.estatus


# --------------------------------------------------------------- L2-08
def test_inicio_futuro_no_suspende_hoy_ni_crea_estatus_nuevo(mundo, hoy):
    propio = mundo['cargo']('P1', mundo['enc'])
    vacante = mundo['cargo']('V1', None, mundo['vacante_estatus'])
    p = _crear(mundo, vacante, D(2026, 12, 1), D(2026, 12, 31))
    assert p.estatus_nombre == 'ACTIVO'
    assert not EstatusModel.objects.filter(estatus__iexact='PROGRAMADO').exists()
    assert _est(propio) == 'ACTIVO'
    assert _est(vacante) == 'VACANTE'
    assert not PrestamoCargoSuspensionModel.objects.exists()


def test_cambio_de_dia_suspende_al_llegar_el_inicio(mundo, hoy):
    propio = mundo['cargo']('P1', mundo['enc'])
    vacante = mundo['cargo']('V1', None, mundo['vacante_estatus'])
    _crear(mundo, vacante, D(2026, 11, 11), D(2026, 12, 31))
    repo = RepoPrestamosCargoORM()
    assert repo.procesar_vencimientos(D(2026, 11, 10))['iniciados'] == 0
    assert _est(propio) == 'ACTIVO'
    assert repo.procesar_vencimientos(D(2026, 11, 11))['iniciados'] == 1  # inicio inclusivo
    assert _est(propio) == 'SUSPENDIDO'
    assert _est(vacante) == 'SUSPENDIDO'
    assert repo.procesar_vencimientos(D(2026, 11, 12))['iniciados'] == 0  # idempotente


def test_ultimo_dia_sigue_vigente_y_finaliza_al_dia_siguiente(mundo, hoy):
    propio = mundo['cargo']('P1', mundo['enc'])
    vacante = mundo['cargo']('V1', None, mundo['vacante_estatus'])
    p = _crear(mundo, vacante, D(2026, 11, 1), D(2026, 11, 10))  # fin == hoy
    assert p.estatus_nombre == 'POR VENCER'
    assert _est(propio) == 'SUSPENDIDO'
    repo = RepoPrestamosCargoORM()
    assert repo.procesar_vencimientos(D(2026, 11, 10))['finalizados'] == 0  # fin inclusivo
    assert repo.procesar_vencimientos(D(2026, 11, 11))['finalizados'] == 1
    assert _est(propio) == 'ACTIVO'
    assert _est_prestamo(p) == 'FINALIZADA'


# --------------------------------------------------------------- L2-06
def test_finalizar_restaura_solo_lo_que_suspendio_el_prestamo(mundo, hoy):
    propio = mundo['cargo']('P1', mundo['enc'])
    sancionado = mundo['cargo']('P2', mundo['enc'], mundo['suspendido'])  # otra causa
    vacante = mundo['cargo']('V1', None, mundo['vacante_estatus'])
    p = _crear(mundo, vacante, D(2026, 11, 1), D(2026, 12, 31))
    assert _est(propio) == 'SUSPENDIDO'
    RepoPrestamosCargoORM().finalizar_prestamo(p.id)
    assert _est(propio) == 'ACTIVO'
    assert _est(sancionado) == 'SUSPENDIDO'   # no se reactiva
    assert _est(vacante) == 'VACANTE'         # vuelve a su estado previo
    assert not PrestamoCargoSuspensionModel.objects.exists()
    assert AsigTrabajoModel.objects.get(pk=propio.pk).observaciones in (None, '')


def test_tarea_finaliza_vencido_con_el_cambio_de_dia_y_es_idempotente(mundo, hoy):
    propio = mundo['cargo']('P1', mundo['enc'])
    vacante = mundo['cargo']('V1', None, mundo['vacante_estatus'])
    _crear(mundo, vacante, D(2026, 11, 1), D(2026, 11, 12))
    repo = RepoPrestamosCargoORM()
    assert repo.procesar_vencimientos(D(2026, 11, 13))['finalizados'] == 1
    assert repo.procesar_vencimientos(D(2026, 11, 14))['finalizados'] == 0
    assert _est(propio) == 'ACTIVO'
    assert _est(vacante) == 'VACANTE'


def test_prestamo_anterior_a_la_tabla_solo_reactiva_el_cargo_encargado(mundo, hoy):
    sancionado = mundo['cargo']('P2', mundo['enc'], mundo['suspendido'])
    vacante = mundo['cargo']('V1', None, mundo['suspendido'])
    p = _crear(mundo, vacante, D(2026, 11, 1), D(2026, 12, 31))
    PrestamoCargoSuspensionModel.objects.all().delete()  # simula un prestamo previo a la tabla
    RepoPrestamosCargoORM().finalizar_prestamo(p.id)
    assert _est(vacante) == 'ACTIVO'
    assert _est(sancionado) == 'SUSPENDIDO'


# --------------------------------------------------------------- L2-19
def test_asignar_cargo_bloquea_la_fila_y_rechaza_segunda_asignacion(mundo):
    vacante = mundo['cargo']('V1', None, mundo['vacante_estatus'])
    repo = RepoCargosORM()
    with patch(
        'apps.cargos.infrastructure.repositories.repo_cargos_orm.AsigTrabajoModel.objects'
    ) as objs:
        objs.select_for_update.return_value.filter.return_value.first.return_value = None
        with pytest.raises(Exception):
            repo.asignar_cargo_a_empleado(vacante.pk, 'V1')
        objs.select_for_update.assert_called_once()
    repo.asignar_cargo_a_empleado(vacante.pk, 'V1')
    with pytest.raises(ConflictError):
        repo.asignar_cargo_a_empleado(vacante.pk, 'V2')
    assert AsigTrabajoModel.objects.get(pk=vacante.pk).employee_id == 'V1'
