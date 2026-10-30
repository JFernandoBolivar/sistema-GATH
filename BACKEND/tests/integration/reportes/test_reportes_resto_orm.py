"""
G11: el resto de reportes (códigos, familiares, egresos, vacantes) sobre la BD
de pruebas con el repositorio ORM real.

Cubre las reglas compartidas: `limite` + metadatos de truncado, orden total y
estable entre ejecuciones, página materializada con sus datos completos,
reingreso más reciente en egresos y elección de la asignación ACTIVA (o la más
reciente) cuando el empleado tiene varias.
"""
import datetime

import pytest

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    GradoModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.pasivos.infrastructure.models.pasivo_models import (
    CargoEgresadoModel,
    EmployeeEgresadoModel,
)
from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.reportes.application.use_cases.generar_reportes import (
    generar_reporte_codigos,
    generar_reporte_familiares,
    generar_reporte_pasivos,
    generar_reporte_vacantes,
)
from apps.reportes.infrastructure.repositories.repo_reportes_orm import RepoReportesORM

pytestmark = pytest.mark.django_db

HOY = datetime.date(2026, 10, 30)


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='F')
    activo = EstatusModel.objects.create(estatus='ACTIVO')
    inactivo = EstatusModel.objects.create(estatus='EGRESADO')
    nomina = TipoNominaModel.objects.create(nomina='FIJO')
    grado = GradoModel.objects.create(grado='GRADO 1')
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    cargo_especifico = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dependencia = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    direccion = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dependencia)
    parentesco = ParentescoModel.objects.create(descripcion_parentesco='HIJO(A)')
    personal = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    motivo = TipoMovimientoModel.objects.create(movimiento='JUBILACION')

    def crear_empleado(cedula, apellidos, nombres='Nombre'):
        return EmployeeModel.objects.create(
            cedulaidentidad=cedula,
            nombres=nombres,
            apellidos=apellidos,
            fecha_nacimiento=datetime.date(1980, 1, 1),
            total_anos_apn=10,
            sexoid=sexo,
        )

    def crear_asignacion(empleado, codigo, estatus, actualizada_en=None):
        asignacion = AsigTrabajoModel.objects.create(
            employee=empleado,
            codigo=codigo,
            denominacioncargoid=cargo,
            denominacioncargoespecificoid=cargo_especifico,
            tiponominaid=nomina,
            estatusid=estatus,
            Dependencia=dependencia,
            DireccionGeneral=direccion,
            gradoid=grado,
        )
        if actualizada_en is not None:
            # `fecha_actualizacion` es auto_now: se fija con un UPDATE directo.
            AsigTrabajoModel.objects.filter(pk=asignacion.pk).update(
                fecha_actualizacion=actualizada_en)
            asignacion.refresh_from_db()
        return asignacion

    # A: activa antigua + inactiva reciente → debe ganar la ACTIVA.
    empleado_a = crear_empleado('V100', 'Alvarez')
    asignacion_activa_a = crear_asignacion(
        empleado_a, 'C-A-ACTIVA', activo, datetime.datetime(2020, 1, 1, tzinfo=datetime.timezone.utc))
    crear_asignacion(
        empleado_a, 'C-A-INACTIVA', inactivo, datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc))

    # B: dos inactivas → debe ganar la más reciente.
    empleado_b = crear_empleado('V200', 'Bravo')
    crear_asignacion(
        empleado_b, 'C-B-VIEJA', inactivo, datetime.datetime(2019, 1, 1, tzinfo=datetime.timezone.utc))
    crear_asignacion(
        empleado_b, 'C-B-NUEVA', inactivo, datetime.datetime(2025, 1, 1, tzinfo=datetime.timezone.utc))

    # Vacantes (sin empleado): dos para poder probar el truncado por código.
    crear_asignacion(None, 'C-Z-VACANTE', activo)
    crear_asignacion(None, 'C-Y-VACANTE', activo)

    # Familiares de A y B.
    for cedula_emp, apellido_familiar in ((empleado_a, 'Zabala'), (empleado_b, 'Arias')):
        EmployeefamilyModel.objects.create(
            employeecedula=cedula_emp,
            cedulaFamiliar='V9000',
            primer_nombre='Ana',
            primer_apellido=apellido_familiar,
            parentesco=parentesco,
            fechanacimiento=datetime.date(2010, 5, 5),
            sexo=sexo,
        )

    # Egresos: A con dos antecedentes (2015 y 2018) y B sin antecedentes.
    egreso_a = EmployeeEgresadoModel.objects.create(
        employee=empleado_a,
        fechaingresoorganismo=datetime.date(2015, 1, 1),
        motivo_egreso=motivo,
    )
    egreso_b = EmployeeEgresadoModel.objects.create(
        employee=empleado_b,
        fechaingresoorganismo=datetime.date(2016, 1, 1),
        motivo_egreso=motivo,
    )
    AntecedenteServicioModel.objects.create(
        empleado=empleado_a, fecha_ingreso=datetime.date(2015, 1, 1))
    AntecedenteServicioModel.objects.create(
        empleado=empleado_a, fecha_ingreso=datetime.date(2018, 6, 1))
    CargoEgresadoModel.objects.create(
        egreso=egreso_a,
        codigo='C-A-ACTIVA',
        denominacioncargoid=cargo,
        denominacioncargoespecificoid=cargo_especifico,
        tipoNominaId=nomina,
        tipoPersonalId=personal,
        dependenciaId=dependencia,
    )

    return {
        'activo': activo,
        'inactivo': inactivo,
        'empleado_a': empleado_a,
        'empleado_b': empleado_b,
        'asignacion_activa_a': asignacion_activa_a,
        'egreso_a': egreso_a,
        'egreso_b': egreso_b,
    }


def _codigos(limite=5000):
    return generar_reporte_codigos(RepoReportesORM(), filtros={}, limite=limite)


def _vacantes(limite=5000):
    return generar_reporte_vacantes(RepoReportesORM(), limite=limite)


def _familiares(limite=5000):
    return generar_reporte_familiares(RepoReportesORM(), filtros={}, limite=limite)


def _egresos(limite=5000):
    return generar_reporte_pasivos(RepoReportesORM(), filtros={}, limite=limite)


def test_codigos_truncado_con_datos_completos(escenario):
    reporte = _codigos(limite=2)

    assert reporte.total_registros == 2
    assert reporte.metadatos['truncado'] is True
    assert reporte.metadatos['total_encontrados'] == 6
    assert reporte.metadatos['limite'] == 2
    # Orden por código: C-A-ACTIVA y C-A-INACTIVA.
    assert [f['codigo'] for f in reporte.filas] == ['C-A-ACTIVA', 'C-A-INACTIVA']
    assert [f['estatus'] for f in reporte.filas] == ['ACTIVO', 'EGRESADO']
    for fila in reporte.filas:
        assert fila['cargo'] == 'ANALISTA'
        assert fila['grado'] == 'GRADO 1'


def test_codigos_orden_estable_entre_ejecuciones(escenario):
    primera = [f['codigo'] for f in _codigos().filas]
    segunda = [f['codigo'] for f in _codigos().filas]

    assert primera == segunda
    assert primera == sorted(primera)


def test_vacantes_ordenadas_y_truncadas(escenario):
    reporte = _vacantes(limite=1)

    assert reporte.metadatos['truncado'] is True
    assert reporte.metadatos['total_encontrados'] == 2
    assert [f['codigo_nomina'] for f in reporte.filas] == ['C-Y-VACANTE']
    assert reporte.filas[0]['denominacion'] == 'ANALISTA'

    completa = _vacantes()
    assert [f['codigo_nomina'] for f in completa.filas] == ['C-Y-VACANTE', 'C-Z-VACANTE']


def test_familiares_truncado_y_orden_estable(escenario):
    completa = _familiares()
    assert completa.metadatos['total_encontrados'] == 2
    # Orden por apellidos del trabajador: Alvarez antes que Bravo.
    assert [f['nombre_empleado'] for f in completa.filas] == ['Nombre Alvarez', 'Nombre Bravo']

    truncada = _familiares(limite=1)
    assert truncada.metadatos['truncado'] is True
    assert len(truncada.filas) == 1
    assert truncada.filas[0]['nombre_empleado'] == 'Nombre Alvarez'
    assert truncada.filas[0]['parentesco'] == 'HIJO(A)'
    assert truncada.filas[0]['sexo'] == 'F'

    primera = [f['nombre_familiar'] for f in _familiares().filas]
    segunda = [f['nombre_familiar'] for f in _familiares().filas]
    assert primera == segunda


def test_egresos_muestra_el_reingreso_mas_reciente(escenario):
    reporte = _egresos()

    fila_a = next(f for f in reporte.filas if f['cedula'] == 'V100')
    fila_b = next(f for f in reporte.filas if f['cedula'] == 'V200')
    assert fila_a['fecha_ingreso'] == '01/06/2018'
    assert fila_b['fecha_ingreso'] == 'N/A'
    assert fila_a['ultimo_cargo'] == 'ANALISTA'


def test_egresos_sin_snapshot_usa_la_asignacion_vigente(escenario):
    reporte = _egresos()

    fila_b = next(f for f in reporte.filas if f['cedula'] == 'V200')
    # B no tiene CargoEgresado: se usa su asignación ACTIVA o la más reciente.
    assert fila_b['ultimo_cargo'] == 'ANALISTA'


def test_egresos_orden_estable_y_truncado(escenario):
    primera = [f['cedula'] for f in _egresos().filas]
    segunda = [f['cedula'] for f in _egresos().filas]
    assert primera == segunda == ['V100', 'V200']

    truncada = _egresos(limite=1)
    assert truncada.metadatos['truncado'] is True
    assert truncada.metadatos['total_encontrados'] == 2
    assert [f['cedula'] for f in truncada.filas] == ['V100']
