"""
Cada filtro de cada reporte devuelve exactamente las filas correctas, sobre la BD
de pruebas y con el repositorio ORM real: personal activo, pasivos, familiares de
activos, familiares de pasivos, egresados, códigos, cargos vacantes y la
distribución/tendencia. Cubre combinaciones, el caso sin filtros y que activos y
pasivos nunca se mezclan.

Datos (todos creados aquí):
  V100 A1  activo (tipo ACTIVO)        V200 A2  activo (sin tipo)
  V300 P1  pasivo por asignación PASIVO   V400 P2  pasivo por registro de egreso
  V500 P3  dado de baja (PASIVO + EGRESADO): ni activo ni pasivo
  V600 S   sin asignación: ni activo ni pasivo
Filtros que NO se cubren aquí: vivienda (región/estado/municipio/parroquia/condición)
y formación complementaria (capacitación/procedencia/grupo) del reporte de personal.
"""
import datetime

import pytest

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
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
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
    OrganismoAdscritoModel,
)
from apps.pasivos.infrastructure.models.pasivo_models import (
    CargoEgresadoModel,
    EmployeeEgresadoModel,
)
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    CarreraModel,
    CategoriaDiscapacidadModel,
    CategoriaPatologiaModel,
    DiscapacidadModel,
    GrupoSanguineoModel,
    MencionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    FormacionAcademicaModel,
    PerfilSaludDiscapacidad,
    PerfilSaludModel,
    PerfilSaludPatologia,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.reportes.application.use_cases.generar_reportes import (
    generar_reporte_codigos,
    generar_reporte_distribucion_nomina,
    generar_reporte_familiares,
    generar_reporte_pasivos,
    generar_reporte_pasivos_actuales,
    generar_reporte_personal,
    generar_reporte_tendencias,
    generar_reporte_vacantes,
)
from apps.reportes.infrastructure.repositories.repo_reportes_orm import RepoReportesORM
from core.domain.exceptions import PermissionDeniedError, ValidationError
from core.infrastructure.report_field_registry import ReportFieldRegistryORM

pytestmark = pytest.mark.django_db

HOY = datetime.date(2026, 10, 30)
A1, A2, P1, P2, P3, S = 'V100', 'V200', 'V300', 'V400', 'V500', 'V600'


@pytest.fixture
def d():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    o = {}
    o['F'] = SexoModel.objects.create(sexo='F')
    o['M'] = SexoModel.objects.create(sexo='M')
    o['activo'] = EstatusModel.objects.create(estatus='ACTIVO')
    o['egresado'] = EstatusModel.objects.create(estatus='EGRESADO')
    o['fijo'] = TipoNominaModel.objects.create(nomina='FIJO')
    o['contratado'] = TipoNominaModel.objects.create(nomina='CONTRATADO')
    o['pens'] = TipoNominaModel.objects.create(nomina='PENSIONADO')
    o['g1'] = GradoModel.objects.create(grado='GRADO 1')
    o['g2'] = GradoModel.objects.create(grado='GRADO 2')
    o['k1'] = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    o['k2'] = DenominacionCargoModel.objects.create(cargo='TECNICO')
    o['e1'] = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    o['e2'] = DenominacionCargoEspecificoModel.objects.create(cargo='TECNICO II')
    o['d1'] = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    o['d2'] = DependenciaModel.objects.create(Codigo='D2', dependencia='OTRA')
    o['dg1'] = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='GESTION HUMANA', dependenciaId=o['d1'])
    o['dg2'] = DireccionGeneralModel.objects.create(
        Codigo='DG2', direccion_general='ADMINISTRACION', dependenciaId=o['d2'])
    o['l1'] = DireccionLineaModel.objects.create(
        Codigo='L1', direccion_linea='NOMINA', direccionGeneral=o['dg1'])
    o['c1'] = CoordinacionModel.objects.create(
        Codigo='C1', coordinacion='PAGOS', direccionLinea=o['l1'])
    o['org'] = OrganismoAdscritoModel.objects.create(Organismoadscrito='CONATEL SEDE')
    o['tp_activo'] = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    o['tp_pasivo'] = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    o['soltero'] = EstadoCivilModel.objects.create(estadoCivil='SOLTERO')
    o['casado'] = EstadoCivilModel.objects.create(estadoCivil='CASADO')
    o['sangre_o'] = GrupoSanguineoModel.objects.create(GrupoSanguineo='O+')
    o['sangre_a'] = GrupoSanguineoModel.objects.create(GrupoSanguineo='A+')
    o['superior'] = NivelAcademicoModel.objects.create(nivelacademico='SUPERIOR')
    o['tecnico'] = NivelAcademicoModel.objects.create(nivelacademico='TECNICO')
    o['carrera'] = CarreraModel.objects.create(nombre_carrera='INGENIERIA')
    o['mencion'] = MencionModel.objects.create(carrera_id=o['carrera'], nombre_mencion='SISTEMAS')
    cat_disc = CategoriaDiscapacidadModel.objects.create(nombre_categoria='FISICA')
    o['motora'] = DiscapacidadModel.objects.create(discapacidad='MOTORA', categoria=cat_disc)
    cat_pat = CategoriaPatologiaModel.objects.create(nombre_categoria='CRONICA')
    o['pato'] = PatologiaCronicaModel.objects.create(patologia='ASMA', categoria=cat_pat)
    o['hijo'] = ParentescoModel.objects.create(descripcion_parentesco='HIJO(A)')
    o['conyuge'] = ParentescoModel.objects.create(descripcion_parentesco='CONYUGE')
    o['madre'] = ParentescoModel.objects.create(descripcion_parentesco='MADRE')
    o['jub'] = TipoMovimientoModel.objects.create(movimiento='JUBILACION')
    o['fall'] = TipoMovimientoModel.objects.create(movimiento='FALLECIMIENTO')

    def empleado(cedula, sexo, nacimiento, estado_civil=None):
        return EmployeeModel.objects.create(
            cedulaidentidad=cedula, nombres=f'Nombre {cedula}', apellidos=f'Apellido {cedula}',
            fecha_nacimiento=nacimiento, sexoid=sexo, estadoCivil=estado_civil, total_anos_apn=0,
        )

    def asignacion(emp, codigo, cargo, esp, nomina, dep, dg, estatus=None, tipo=None, **extra):
        return AsigTrabajoModel.objects.create(
            employee=emp, codigo=codigo, denominacioncargoid=cargo,
            denominacioncargoespecificoid=esp, tiponominaid=nomina,
            estatusid=estatus or o['activo'], Dependencia=dep, DireccionGeneral=dg,
            Tipo_personal=tipo, **extra,
        )

    def antecedente(emp, ingreso, egreso):
        AntecedenteServicioModel.objects.create(
            empleado=emp, fecha_ingreso=ingreso, fecha_egreso=egreso)

    def familiar(emp, nombre, apellido, parentesco, sexo, nacimiento):
        return EmployeefamilyModel.objects.create(
            employeecedula=emp, cedulaFamiliar='V9', primer_nombre=nombre,
            primer_apellido=apellido, parentesco=parentesco, sexo=sexo, fechanacimiento=nacimiento)

    # --- activos
    o[A1] = empleado(A1, o['F'], datetime.date(1996, 6, 1), o['soltero'])
    asignacion(o[A1], 'C-A1', o['k1'], o['e1'], o['fijo'], o['d1'], o['dg1'], tipo=o['tp_activo'],
               DireccionLinea=o['l1'], Coordinacion=o['c1'], OrganismoAdscritoid=o['org'],
               gradoid=o['g1'])
    antecedente(o[A1], datetime.date(2000, 1, 1), datetime.date(2012, 1, 1))  # 12 años
    perfil = PerfilSaludModel.objects.create(empleado=o[A1], grupo_sanguineo=o['sangre_o'])
    PerfilSaludDiscapacidad.objects.create(perfil_salud=perfil, discapacidades=o['motora'])
    PerfilSaludPatologia.objects.create(perfil_salud=perfil, patologias_cronicas=o['pato'])
    FormacionAcademicaModel.objects.create(
        empleado=o[A1], nivel_academico=o['superior'], carrera=o['carrera'], mencion=o['mencion'])
    o['hijo_a1'] = familiar(o[A1], 'Hijo', 'A1', o['hijo'], o['F'], datetime.date(2010, 5, 5))
    PerfilSaludModel.objects.create(familiar=o['hijo_a1'], grupo_sanguineo=o['sangre_o'])

    o[A2] = empleado(A2, o['M'], datetime.date(1976, 6, 1), o['casado'])
    asignacion(o[A2], 'C-A2', o['k2'], o['e2'], o['contratado'], o['d2'], o['dg2'], gradoid=o['g2'])
    antecedente(o[A2], datetime.date(2005, 1, 1), datetime.date(2030, 1, 1))  # 25 años
    perfil = PerfilSaludModel.objects.create(empleado=o[A2], grupo_sanguineo=o['sangre_a'])
    FormacionAcademicaModel.objects.create(empleado=o[A2], nivel_academico=o['tecnico'])
    familiar(o[A2], 'Conyuge', 'A2', o['conyuge'], o['F'], datetime.date(1978, 3, 3))
    o['hijo_a2'] = familiar(o[A2], 'Hijo', 'A2', o['hijo'], o['M'], datetime.date(2015, 2, 2))
    perfil_f = PerfilSaludModel.objects.create(familiar=o['hijo_a2'])
    PerfilSaludDiscapacidad.objects.create(perfil_salud=perfil_f, discapacidades=o['motora'])
    PerfilSaludPatologia.objects.create(perfil_salud=perfil_f, patologias_cronicas=o['pato'])

    # --- pasivos
    o[P1] = empleado(P1, o['F'], datetime.date(1955, 5, 5), o['casado'])
    asignacion(o[P1], 'C-P1', o['k1'], o['e1'], o['pens'], o['d1'], o['dg1'], tipo=o['tp_pasivo'])
    familiar(o[P1], 'Madre', 'P1', o['madre'], o['F'], datetime.date(1930, 1, 1))
    familiar(o[P1], 'Hijo', 'P1', o['hijo'], o['M'], datetime.date(1985, 1, 1))

    o[P2] = empleado(P2, o['M'], datetime.date(1960, 1, 1))
    o['egreso_p2'] = EmployeeEgresadoModel.objects.create(
        employee=o[P2], fechaingresoorganismo=datetime.date(2000, 1, 1), motivo_egreso=o['jub'])
    CargoEgresadoModel.objects.create(
        egreso=o['egreso_p2'], codigo='C-P2', denominacioncargoid=o['k1'],
        denominacioncargoespecificoid=o['e1'], tipoNominaId=o['fijo'],
        tipoPersonalId=o['tp_pasivo'], dependenciaId=o['d1'])
    familiar(o[P2], 'Hija', 'P2', o['hijo'], o['F'], datetime.date(1990, 1, 1))

    # --- dado de baja (cesado): PASIVO + EGRESADO, con registro de egreso
    o[P3] = empleado(P3, o['F'], datetime.date(1950, 1, 1))
    asignacion(o[P3], 'C-P3', o['k2'], o['e2'], o['contratado'], o['d2'], o['dg2'],
               estatus=o['egresado'], tipo=o['tp_pasivo'])
    o['egreso_p3'] = EmployeeEgresadoModel.objects.create(
        employee=o[P3], fechaingresoorganismo=datetime.date(1990, 1, 1), motivo_egreso=o['fall'])
    CargoEgresadoModel.objects.create(
        egreso=o['egreso_p3'], codigo='C-P3', denominacioncargoid=o['k2'],
        denominacioncargoespecificoid=o['e2'], tipoNominaId=o['contratado'],
        tipoPersonalId=o['tp_pasivo'], dependenciaId=o['d2'])
    familiar(o[P3], 'Fam', 'P3', o['hijo'], o['F'], datetime.date(2000, 1, 1))

    # --- sin asignación
    o[S] = empleado(S, o['M'], datetime.date(1990, 1, 1))
    familiar(o[S], 'Fam', 'S', o['hijo'], o['M'], datetime.date(2015, 1, 1))

    # --- vacantes
    asignacion(None, 'C-V1', o['k1'], o['e1'], o['fijo'], o['d1'], o['dg1'])
    asignacion(None, 'C-V2', o['k2'], o['e2'], o['contratado'], o['d2'], o['dg2'])

    # Fechas de egreso (auto_now_add): se fijan con UPDATE.
    EmployeeEgresadoModel.objects.filter(pk=o['egreso_p2'].pk).update(
        fecha_egreso=datetime.datetime(2026, 1, 15, 10, tzinfo=datetime.timezone.utc))
    EmployeeEgresadoModel.objects.filter(pk=o['egreso_p3'].pk).update(
        fecha_egreso=datetime.datetime(2026, 6, 15, 10, tzinfo=datetime.timezone.utc))
    return o


def _personal(f=None, limite=5000):
    return generar_reporte_personal(
        RepoReportesORM(), filtros=f or {}, registro=ReportFieldRegistryORM(),
        puede_filtrar_estructura=True, limite=limite, hoy=HOY)


def _pasivos(f=None):
    return generar_reporte_pasivos_actuales(
        RepoReportesORM(), filtros=f or {}, registro=ReportFieldRegistryORM(),
        puede_filtrar_estructura=True, limite=5000, hoy=HOY)


def _familiares(condicion, f=None, estructura=True):
    return generar_reporte_familiares(
        RepoReportesORM(), filtros=f or {}, limite=5000, condicion=condicion,
        registro=ReportFieldRegistryORM(), puede_filtrar_estructura=estructura, hoy=HOY)


def _ced(rep):
    return sorted(f['cedula'] for f in rep.filas)


def _fam(rep):
    return sorted(f['nombre_familiar'] for f in rep.filas)


# ------------------------------------------------------------ personal activo

def test_personal_activo_sin_filtros_solo_trae_activos(d):
    assert _ced(_personal()) == [A1, A2]


def _casos_personal(d):
    return [
        ({'sexo_id': d['F'].pk}, [A1]),
        ({'sexo_id': d['M'].pk}, [A2]),
        ({'estado_civil_id': d['soltero'].pk}, [A1]),
        ({'estado_civil_id': d['casado'].pk}, [A2]),  # P1 también es casada: no se mezcla
        ({'dependencia_id': d['d1'].pk}, [A1]),
        ({'dependencia_id': d['d2'].pk}, [A2]),
        ({'direccion_general_id': d['dg1'].pk}, [A1]),
        ({'direccion_linea_id': d['l1'].pk}, [A1]),
        ({'coordinacion_id': d['c1'].pk}, [A1]),
        ({'OrganismoAdscrito_id': d['org'].pk}, [A1]),
        ({'nomina_id': d['fijo'].pk}, [A1]),
        ({'nomina_id': d['contratado'].pk}, [A2]),
        ({'nomina_id': d['pens'].pk}, []),
        ({'grado_id': d['g1'].pk}, [A1]),
        ({'grado_id': d['g2'].pk}, [A2]),
        ({'cargo_id': d['k1'].pk}, [A1]),
        ({'cargo_especifico_id': d['e2'].pk}, [A2]),
        ({'estatus_id': d['activo'].pk}, [A1, A2]),
        ({'estatus_id': d['egresado'].pk}, []),
        ({'tipo_personal_id': d['tp_activo'].pk}, [A1]),
        ({'tipo_personal_id': d['tp_pasivo'].pk}, []),
        ({'grupo_sanguineo_id': d['sangre_o'].pk}, [A1]),
        ({'grupo_sanguineo_id': d['sangre_a'].pk}, [A2]),
        ({'discapacidad_id': d['motora'].pk}, [A1]),
        ({'patologia_id': d['pato'].pk}, [A1]),
        ({'nivel_academico_id': d['superior'].pk}, [A1]),
        ({'nivel_academico_id': d['tecnico'].pk}, [A2]),
        ({'carrera_id': d['carrera'].pk}, [A1]),
        ({'mencion_id': d['mencion'].pk}, [A1]),
        ({'edad_min': 40}, [A2]),
        ({'edad_max': 40}, [A1]),
        ({'edad_min': 20, 'edad_max': 60}, [A1, A2]),
        ({'edad_min': 60}, []),
        ({'apn_min': 20}, [A2]),
        ({'apn_max': 20}, [A1]),
        ({'apn_min': 10, 'apn_max': 30}, [A1, A2]),
        ({'fecha_ingreso_Desde': '2003-01-01'}, [A2]),
        ({'fecha_ingreso_Hasta': '2003-01-01'}, [A1]),
        ({'fecha_apn_Desde': '2003-01-01'}, [A2]),
        ({'fecha_apn_Hasta': '2003-01-01'}, [A1]),
        # combinaciones
        ({'sexo_id': 'F', 'dependencia_id': 'D1'}, [A1]),
        ({'sexo_id': 'F', 'dependencia_id': 'D2'}, []),
        ({'nomina_id': 'FIJO', 'edad_max': 40}, [A1]),
        ({'nomina_id': 'FIJO', 'edad_min': 40}, []),
        ({'cargo_id': 'K2', 'grado_id': 'G2', 'apn_min': 20}, [A2]),
    ]


def test_personal_activo_cada_filtro_y_combinacion(d):
    traducciones = {
        'F': d['F'].pk, 'M': d['M'].pk, 'D1': d['d1'].pk, 'D2': d['d2'].pk,
        'FIJO': d['fijo'].pk, 'K2': d['k2'].pk, 'G2': d['g2'].pk,
    }
    for filtros, esperado in _casos_personal(d):
        filtros = {k: traducciones.get(v, v) for k, v in filtros.items()}
        assert _ced(_personal(filtros)) == esperado, filtros


def test_personal_activo_conteo_no_cuenta_pasivos(d):
    rep = _personal({'tipo_reporte': 'conteo', 'agrupar_por': 'sexo'})
    assert {f['sexo']: f['total'] for f in rep.filas} == {'F': 1, 'M': 1}


def test_personal_activo_filtro_desconocido_o_sin_permiso(d):
    with pytest.raises(ValidationError):
        _personal({'no_existe': 1})
    with pytest.raises(PermissionDeniedError):
        generar_reporte_personal(
            RepoReportesORM(), filtros={'dependencia_id': d['d1'].pk},
            registro=ReportFieldRegistryORM(), puede_filtrar_estructura=False, limite=10, hoy=HOY)


# ------------------------------------------------------------------- pasivos

def test_pasivos_sin_filtros_solo_trae_pasivos_vigentes(d):
    # P3 (dado de baja) y S (sin asignación) quedan fuera; ningún activo entra.
    assert _ced(_pasivos()) == [P1, P2]


def test_pasivos_cada_filtro_y_combinacion(d):
    casos = [
        ({'sexo_id': d['F'].pk}, [P1]),
        ({'sexo_id': d['M'].pk}, [P2]),
        ({'estado_civil_id': d['casado'].pk}, [P1]),  # A2 también es casado: no se mezcla
        ({'dependencia_id': d['d1'].pk}, [P1]),
        ({'dependencia_id': d['d2'].pk}, []),
        ({'direccion_general_id': d['dg1'].pk}, [P1]),
        ({'nomina_id': d['pens'].pk}, [P1]),
        ({'nomina_id': d['fijo'].pk}, []),
        ({'cargo_id': d['k1'].pk}, [P1]),
        ({'tipo_personal_id': d['tp_pasivo'].pk}, [P1]),
        ({'tipo_personal_id': d['tp_activo'].pk}, []),
        ({'edad_min': 70}, [P1]),
        ({'edad_max': 70}, [P2]),
        ({'edad_min': 60, 'edad_max': 80}, [P1, P2]),
        ({'sexo_id': d['F'].pk, 'nomina_id': d['pens'].pk}, [P1]),
        ({'sexo_id': d['M'].pk, 'nomina_id': d['pens'].pk}, []),
    ]
    for filtros, esperado in casos:
        assert _ced(_pasivos(filtros)) == esperado, filtros


def test_activos_y_pasivos_son_disjuntos(d):
    assert set(_ced(_personal())).isdisjoint(_ced(_pasivos()))
    assert P3 not in _ced(_personal()) + _ced(_pasivos())
    assert S not in _ced(_personal()) + _ced(_pasivos())


# ----------------------------------------------------------------- familiares

def test_familiares_sin_filtros_por_condicion(d):
    assert _fam(_familiares('ACTIVO')) == ['Conyuge A2', 'Hijo A1', 'Hijo A2']
    assert _fam(_familiares('PASIVO')) == ['Hija P2', 'Hijo P1', 'Madre P1']
    assert _familiares('ACTIVO').titulo == 'Reporte de Familiares'
    assert _familiares('PASIVO').titulo == 'Reporte de Familiares de Pasivos'


def test_familiares_de_activos_y_de_pasivos_no_se_mezclan(d):
    todos = _fam(_familiares('ACTIVO')) + _fam(_familiares('PASIVO'))
    assert len(todos) == len(set(todos)) == 6
    assert 'Fam P3' not in todos and 'Fam S' not in todos


def test_familiares_de_activos_cada_filtro_y_combinacion(d):
    casos = [
        ({'parentesco_id': d['hijo'].pk}, ['Hijo A1', 'Hijo A2']),
        ({'parentesco_id': d['conyuge'].pk}, ['Conyuge A2']),
        ({'parentesco_id': d['madre'].pk}, []),  # la madre es de un pasivo
        ({'sexo_familiar_id': d['F'].pk}, ['Conyuge A2', 'Hijo A1']),
        ({'sexo_id': d['M'].pk}, ['Hijo A2']),  # alias del contrato anterior
        ({'cedula_empleado': A2}, ['Conyuge A2', 'Hijo A2']),
        ({'cedula_empleado': P1}, []),
        ({'sexo_empleado_id': d['F'].pk}, ['Hijo A1']),
        ({'sexo_empleado_id': d['M'].pk}, ['Conyuge A2', 'Hijo A2']),
        ({'edad_familiar_min': 18}, ['Conyuge A2']),
        ({'edad_familiar_max': 15}, ['Hijo A2']),
        ({'edad_familiar_min': 12, 'edad_familiar_max': 20}, ['Hijo A1']),
        ({'edad_empleado_min': 40}, ['Conyuge A2', 'Hijo A2']),
        ({'edad_empleado_max': 40}, ['Hijo A1']),
        ({'nomina_id': d['fijo'].pk}, ['Hijo A1']),
        ({'nomina_id': d['pens'].pk}, []),
        ({'dependencia_id': d['d2'].pk}, ['Conyuge A2', 'Hijo A2']),
        ({'direccion_general_id': d['dg1'].pk}, ['Hijo A1']),
        ({'direccion_linea_id': d['l1'].pk}, ['Hijo A1']),
        ({'coordinacion_id': d['c1'].pk}, ['Hijo A1']),
        ({'estado_civil_id': d['casado'].pk}, ['Conyuge A2', 'Hijo A2']),
        ({'nivel_academico_id': d['tecnico'].pk}, ['Conyuge A2', 'Hijo A2']),
        # salud del FAMILIAR (no la del trabajador, que también es O+/MOTORA/ASMA)
        ({'grupo_sanguineo_id': d['sangre_o'].pk}, ['Hijo A1']),
        ({'discapacidades_id': d['motora'].pk}, ['Hijo A2']),
        ({'patologias_id': d['pato'].pk}, ['Hijo A2']),
        # combinaciones
        ({'parentesco_id': d['hijo'].pk, 'sexo_familiar_id': d['M'].pk}, ['Hijo A2']),
        ({'parentesco_id': d['conyuge'].pk, 'sexo_familiar_id': d['M'].pk}, []),
        ({'cedula_empleado': A2, 'edad_familiar_max': 15}, ['Hijo A2']),
        ({'dependencia_id': d['d2'].pk, 'parentesco_id': d['conyuge'].pk}, ['Conyuge A2']),
    ]
    for filtros, esperado in casos:
        assert _fam(_familiares('ACTIVO', filtros)) == esperado, filtros


def test_familiares_de_pasivos_cada_filtro_y_combinacion(d):
    casos = [
        ({'parentesco_id': d['hijo'].pk}, ['Hija P2', 'Hijo P1']),
        ({'parentesco_id': d['madre'].pk}, ['Madre P1']),
        ({'sexo_familiar_id': d['F'].pk}, ['Hija P2', 'Madre P1']),
        ({'sexo_id': d['M'].pk}, ['Hijo P1']),
        ({'cedula_empleado': P2}, ['Hija P2']),
        ({'cedula_empleado': A1}, []),
        ({'sexo_empleado_id': d['M'].pk}, ['Hija P2']),
        ({'edad_familiar_min': 60}, ['Madre P1']),
        ({'edad_familiar_max': 40}, ['Hija P2']),
        ({'edad_empleado_min': 70}, ['Hijo P1', 'Madre P1']),
        ({'edad_empleado_max': 70}, ['Hija P2']),
        ({'nomina_id': d['pens'].pk}, ['Hijo P1', 'Madre P1']),
        ({'dependencia_id': d['d1'].pk}, ['Hijo P1', 'Madre P1']),
        ({'dependencia_id': d['d2'].pk}, []),
        ({'estado_civil_id': d['casado'].pk}, ['Hijo P1', 'Madre P1']),
        ({'grupo_sanguineo_id': d['sangre_o'].pk}, []),
        ({'parentesco_id': d['hijo'].pk, 'sexo_familiar_id': d['F'].pk}, ['Hija P2']),
    ]
    for filtros, esperado in casos:
        assert _fam(_familiares('PASIVO', filtros)) == esperado, filtros


def test_familiares_validaciones(d):
    with pytest.raises(ValidationError):
        _familiares('ACTIVO', {'no_existe': 1})
    with pytest.raises(ValidationError):
        _familiares('ACTIVO', {'edad_familiar_min': 'abc'})
    with pytest.raises(ValidationError):
        _familiares('TODOS')
    with pytest.raises(PermissionDeniedError):
        _familiares('ACTIVO', {'dependencia_id': d['d1'].pk}, estructura=False)
    # Sin permiso de estructura, el reporte sin filtros de estructura sí funciona.
    assert len(_familiares('ACTIVO', estructura=False).filas) == 3


def test_familiares_el_tope_se_aplica_por_condicion(d):
    rep = generar_reporte_familiares(
        RepoReportesORM(), filtros={}, limite=2, condicion='PASIVO',
        registro=ReportFieldRegistryORM(), hoy=HOY)
    assert len(rep.filas) == 2
    assert rep.metadatos['total_encontrados'] == 3 and rep.metadatos['truncado'] is True
    assert rep.metadatos['condicion'] == 'PASIVO'


# ------------------------------------------------------------------ egresados

def _egresados(f=None):
    return generar_reporte_pasivos(RepoReportesORM(), filtros=f or {}, limite=5000)


def test_egresados_cada_filtro_y_combinacion(d):
    casos = [
        ({}, [P2, P3]),
        ({'motivo_id': d['jub'].pk}, [P2]),
        ({'motivo_id': d['fall'].pk}, [P3]),
        ({'fecha_egreso_Desde': '2026-03-01'}, [P3]),
        ({'fecha_egreso_Hasta': '2026-03-01'}, [P2]),
        ({'fecha_egreso_Desde': '2026-01-01', 'fecha_egreso_Hasta': '2026-12-31'}, [P2, P3]),
        ({'sexo_id': d['M'].pk}, [P2]),
        ({'sexo_id': d['F'].pk}, [P3]),
        ({'cargo_id': d['k1'].pk}, [P2]),
        ({'nomina_id': d['contratado'].pk}, [P3]),
        ({'dependencia_id': d['d1'].pk}, [P2]),
        ({'sexo_id': d['M'].pk, 'motivo_id': d['fall'].pk}, []),
    ]
    for filtros, esperado in casos:
        assert _ced(_egresados(filtros)) == esperado, filtros


# --------------------------------------------------------- códigos y vacantes

def _codigos(f=None):
    rep = generar_reporte_codigos(RepoReportesORM(), filtros=f or {}, limite=5000)
    return sorted(x['codigo'] for x in rep.filas)


def test_codigos_cada_filtro_y_combinacion(d):
    todos = ['C-A1', 'C-A2', 'C-P1', 'C-P3', 'C-V1', 'C-V2']
    casos = [
        ({}, todos),
        ({'cargo_id': d['k1'].pk}, ['C-A1', 'C-P1', 'C-V1']),
        ({'cargo_especifico_id': d['e2'].pk}, ['C-A2', 'C-P3', 'C-V2']),
        ({'nomina_id': d['fijo'].pk}, ['C-A1', 'C-V1']),
        ({'nomina_id': d['pens'].pk}, ['C-P1']),
        ({'dependencia_id': d['d1'].pk}, ['C-A1', 'C-P1', 'C-V1']),
        ({'general_id': d['dg2'].pk}, ['C-A2', 'C-P3', 'C-V2']),
        ({'estatus_id': d['egresado'].pk}, ['C-P3']),
        ({'estatus_id': d['activo'].pk}, ['C-A1', 'C-A2', 'C-P1', 'C-V1', 'C-V2']),
        ({'cargo_id': d['k1'].pk, 'nomina_id': d['fijo'].pk}, ['C-A1', 'C-V1']),
        ({'cargo_id': d['k1'].pk, 'nomina_id': d['contratado'].pk}, []),
    ]
    for filtros, esperado in casos:
        assert _codigos(filtros) == esperado, filtros


def test_vacantes_solo_cargos_sin_trabajador(d):
    rep = generar_reporte_vacantes(RepoReportesORM(), limite=5000)
    assert [f['codigo_nomina'] for f in rep.filas] == ['C-V1', 'C-V2']
    acotado = generar_reporte_vacantes(
        RepoReportesORM(), limite=5000, dependencias_ids=[d['d2'].pk])
    assert [f['codigo_nomina'] for f in acotado.filas] == ['C-V2']


# ------------------------------------------------- distribución y tendencias

def test_distribucion_solo_cuenta_personal_activo(d):
    rep = generar_reporte_distribucion_nomina(RepoReportesORM())
    assert {f['tipo_nomina']: f['total'] for f in rep.filas} == {'FIJO': 1, 'CONTRATADO': 1}


def test_tendencias_cuenta_ingresos_y_egresos_de_los_ultimos_12_meses(d):
    from django.utils import timezone

    hoy = timezone.now()
    EmployeeEgresadoModel.objects.filter(pk=d['egreso_p2'].pk).update(fecha_egreso=hoy)
    EmployeeEgresadoModel.objects.filter(pk=d['egreso_p3'].pk).update(
        fecha_egreso=hoy - datetime.timedelta(days=900))
    AntecedenteServicioModel.objects.create(empleado=d[A1], fecha_ingreso=timezone.localdate())

    rep = generar_reporte_tendencias(RepoReportesORM())

    assert len(rep.filas) == 12
    assert sum(f['egresos'] for f in rep.filas) == 1 and rep.filas[-1]['egresos'] == 1
    assert sum(f['ingresos'] for f in rep.filas) == 1 and rep.filas[-1]['ingresos'] == 1
