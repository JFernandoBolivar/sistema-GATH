"""
Filtros del historial de movimientos y de la bitácora de auditoría (los dos
listados que también se exportan): cada filtro, combinaciones, el caso sin
filtros y que la exportación trae las mismas filas que el listado.
"""
import datetime

import pytest

from apps.auditoria.application.use_cases.consultar_auditoria import exportar_auditoria
from apps.auditoria.domain.value_objects.filtros_auditoria import FiltrosAuditoria
from apps.auditoria.infrastructure.repositories.repo_auditoria_orm import RepoAuditoriaORM
from apps.cargos.infrastructure.models.cargo_models import (
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    CategoriaMovimientoModel,
    EstatusModel,
    GradoModel,
    NacionalidadModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.movimientos.application.use_cases.listar_historial import exportar_historial
from apps.movimientos.domain.value_objects.filtros_historial import FiltrosHistorial
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db


def _dia(n):
    return datetime.datetime(2026, 1, n, 10, 0, tzinfo=datetime.timezone.utc)


@pytest.fixture
def mov():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='F')
    activo = EstatusModel.objects.create(estatus='ACTIVO')
    vacante = EstatusModel.objects.create(estatus='VACANTE')
    nomina = TipoNominaModel.objects.create(nomina='FIJO')
    grado = GradoModel.objects.create(grado='GRADO 1')
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    especifico = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dependencia = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    dg1 = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dependencia)
    dg2 = DireccionGeneralModel.objects.create(
        Codigo='DG2', direccion_general='ADMINISTRACION', dependenciaId=dependencia)
    personal = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    cat_traslado = CategoriaMovimientoModel.objects.create(categoria='TRASLADO')
    cat_egreso = CategoriaMovimientoModel.objects.create(categoria='EGRESO')
    m_traslado = TipoMovimientoModel.objects.create(movimiento='TRASLADO FISICO', categoria=cat_traslado)
    m_renuncia = TipoMovimientoModel.objects.create(movimiento='RENUNCIA', categoria=cat_egreso)
    v1 = EmployeeModel.objects.create(
        cedulaidentidad='V1', nombres='Uno', apellidos='Uno',
        fecha_nacimiento=datetime.date(1985, 1, 1), sexoid=sexo)
    v2 = EmployeeModel.objects.create(
        cedulaidentidad='V2', nombres='Dos', apellidos='Dos',
        fecha_nacimiento=datetime.date(1986, 1, 1), sexoid=sexo)
    rol = RolModel.objects.create(nombre_rol='ANALISTA')
    cuenta = CuentaModel.objects.create(cedula=v1, rol=rol, password='!')

    def crear(emp, codigo, tipo, dia, estatus, dg, motivo=None):
        fila = EmployeeMovementHistoryModel.objects.create(
            empleado=emp, codigo_puesto=codigo, denominacioncargo_id=cargo.pk,
            denominacioncargoespecifico_id=especifico.pk, gradoid_id=grado.pk,
            tiponomina_id=nomina.pk, estatus_id=estatus.pk, tipo_personal_id=personal.pk,
            DependenciasId_id=dependencia.pk, DireccionGeneralid_id=dg.pk,
            tipo_movimiento=tipo, motivo_id=motivo.pk if motivo else None,
            ejecutado_por_id=cuenta.pk)
        EmployeeMovementHistoryModel.objects.filter(pk=fila.pk).update(fecha_movimiento=_dia(dia))
        return fila.pk

    return {
        'm1': crear(v1, 'COD-100', 'INGRESO', 1, activo, dg1),
        'm2': crear(v1, 'COD-100', 'TRASLADO', 2, activo, dg1, m_traslado),
        'm3': crear(v2, 'COD-200', 'EGRESO', 3, vacante, dg2, m_renuncia),
    }


def _ids(parametros, limite=50):
    filtros = FiltrosHistorial.desde_parametros(parametros)
    entidades, total = RepoMovimientosORM().listar_historial(filtros, limite)
    assert total == len(entidades)
    return {e.id for e in entidades}


def test_movimientos_cada_filtro_y_combinacion(mov):
    m1, m2, m3 = mov['m1'], mov['m2'], mov['m3']
    casos = [
        ({}, {m1, m2, m3}),
        ({'cedula': 'V1'}, {m1, m2}),
        ({'cedula': 'V2'}, {m3}),
        ({'cedula': 'V9'}, set()),
        ({'codigo_puesto': '200'}, {m3}),
        ({'codigo_puesto': 'cod-1'}, {m1, m2}),
        ({'categoria': 'TRASLADO'}, {m2}),
        ({'categoria': 'egreso'}, {m3}),
        ({'tipo_movimiento': 'INGRESO'}, {m1}),
        ({'tipo_movimiento': 'renuncia'}, {m3}),
        ({'fecha_inicio': '2026-01-02'}, {m2, m3}),
        ({'fecha_fin': '2026-01-02'}, {m1, m2}),
        ({'fecha_inicio': '2026-01-02', 'fecha_fin': '2026-01-02'}, {m2}),
        ({'gerencia': 'administ'}, {m3}),
        ({'estatus': 'vac'}, {m3}),
        ({'estatus': 'activo'}, {m1, m2}),
        ({'cedula': 'V1', 'categoria': 'TRASLADO'}, {m2}),
        ({'cedula': 'V2', 'fecha_fin': '2026-01-02'}, set()),
        ({'gerencia': 'gestion', 'fecha_inicio': '2026-01-02'}, {m2}),
    ]
    for parametros, esperado in casos:
        assert _ids(parametros) == esperado, parametros


def test_movimientos_rango_invalido_y_fecha_mal_escrita(mov):
    with pytest.raises(ValidationError):
        FiltrosHistorial.desde_parametros({'fecha_inicio': '2026-02-01', 'fecha_fin': '2026-01-01'})
    with pytest.raises(ValidationError):
        FiltrosHistorial.desde_parametros({'fecha_inicio': 'ayer'})


def test_la_exportacion_de_movimientos_trae_las_mismas_filas_que_el_listado(mov):
    for parametros in ({}, {'cedula': 'V1'}, {'estatus': 'vac'}, {'categoria': 'TRASLADO', 'cedula': 'V1'}):
        documento = exportar_historial(RepoMovimientosORM(), parametros, limite=50)
        assert {m.id for m in documento.movimientos} == _ids(parametros)
        assert documento.total_encontrados == len(documento.movimientos)
    truncado = exportar_historial(RepoMovimientosORM(), {}, limite=2)
    assert truncado.truncado is True and len(truncado.movimientos) == 2 and truncado.total_encontrados == 3


# ------------------------------------------------------------------ auditoría

def _log(**extra):
    base = dict(
        trace_id='t', actor_id=1, actor_cedula='V1', actor_rol='ANALISTA', modulo='personal',
        accion='personal.editar', recurso_tipo='Employee', recurso_id='7', ip_origen='10.0.0.1',
        user_agent='UA', resultado='SUCCESS')
    base.update(extra)
    fila = AuditoriaLog.objects.create(**base)
    return str(fila.pk)


@pytest.fixture
def logs():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='F')
    EmployeeModel.objects.create(
        cedulaidentidad='V1', nombres='Ana', apellidos='Perez',
        fecha_nacimiento=datetime.date(1990, 1, 1), sexoid=sexo)
    a = _log()
    b = _log(actor_cedula='V2', modulo='movimientos', accion='movimientos.registrar',
             recurso_tipo='Cargo', recurso_id='9', ip_origen='10.0.0.2', resultado='DENIED')
    c = _log(resultado='FAILED', ip_origen='10.0.0.3')
    for pk, dia in ((a, 1), (b, 2), (c, 3)):
        AuditoriaLog.objects.filter(pk=pk).update(fecha_hora=_dia(dia))
    return {'a': a, 'b': b, 'c': c}


def _ids_log(parametros):
    filtros = FiltrosAuditoria.desde_parametros(parametros)
    registros, total = RepoAuditoriaORM().listar(filtros, 50)
    assert total == len(registros)
    return {str(r.id) for r in registros}


def test_auditoria_cada_filtro_y_combinacion(logs):
    a, b, c = (logs[k] for k in 'abc')
    casos = [
        ({}, {a, b, c}),
        ({'usuario': 'V1'}, {a, c}),
        ({'usuario': 'Ana'}, {a, c}),
        ({'usuario': 'V2'}, {b}),
        ({'accion': 'movimientos.registrar'}, {b}),
        ({'modulo': 'personal'}, {a, c}),
        ({'recurso': 'Cargo'}, {b}),
        ({'recurso': '7'}, {a, c}),
        ({'ip': '10.0.0.2'}, {b}),
        ({'resultado': 'denied'}, {b}),
        ({'resultado': 'FAILED'}, {c}),
        ({'desde': '2026-01-02'}, {b, c}),
        ({'hasta': '2026-01-02'}, {a, b}),
        ({'desde': '2026-01-02', 'hasta': '2026-01-02'}, {b}),
        ({'modulo': 'personal', 'resultado': 'FAILED'}, {c}),
        ({'usuario': 'V1', 'desde': '2026-01-03'}, {c}),
        ({'modulo': 'movimientos', 'resultado': 'SUCCESS'}, set()),
    ]
    for parametros, esperado in casos:
        assert _ids_log(parametros) == esperado, parametros


def test_auditoria_validaciones_y_exportacion_igual_al_listado(logs):
    with pytest.raises(ValidationError):
        FiltrosAuditoria.desde_parametros({'resultado': 'NO_EXISTE'})
    with pytest.raises(ValidationError):
        FiltrosAuditoria.desde_parametros({'desde': '2026-02-01', 'hasta': '2026-01-01'})
    for parametros in ({}, {'modulo': 'personal'}, {'resultado': 'DENIED'}):
        filtros = FiltrosAuditoria.desde_parametros(parametros)
        documento = exportar_auditoria(RepoAuditoriaORM(), filtros, 50)
        assert {str(r.id) for r in documento.registros} == _ids_log(parametros)
