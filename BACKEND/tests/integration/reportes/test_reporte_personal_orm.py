"""
G3 (reporte de trabajador) sobre la BD de pruebas con el repositorio ORM real.

Verifica que los filtros que antes se ignoraban en silencio ahora filtran de
verdad, que el tope de filas es configurable y se informa (`truncado`), y que
`tipo_reporte=conteo`/`agrupar_por` se aplican.
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
    SexoModel,
    TipoNominaModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    CategoriaDiscapacidadModel,
    DiscapacidadModel,
    GrupoSanguineoModel,
    NivelAcademicoModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    FormacionAcademicaModel,
    PerfilSaludDiscapacidad,
    PerfilSaludModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.reportes.application.use_cases.generar_reportes import generar_reporte_personal
from apps.reportes.infrastructure.repositories.repo_reportes_orm import RepoReportesORM
from core.domain.exceptions import ValidationError
from core.infrastructure.report_field_registry import ReportFieldRegistryORM

pytestmark = pytest.mark.django_db

HOY = datetime.date(2026, 10, 30)


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    femenino = SexoModel.objects.create(sexo='F')
    masculino = SexoModel.objects.create(sexo='M')

    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='FIJO')
    grado = GradoModel.objects.create(grado='GRADO 1')
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    cargo_especifico = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dependencia = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    direccion = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dependencia)

    grupo_sanguineo = GrupoSanguineoModel.objects.create(GrupoSanguineo='O+')
    nivel = NivelAcademicoModel.objects.create(nivelacademico='SUPERIOR')
    categoria_discapacidad = CategoriaDiscapacidadModel.objects.create(nombre_categoria='FISICA')
    discapacidad = DiscapacidadModel.objects.create(
        discapacidad='MOTORA', categoria=categoria_discapacidad)

    def crear_empleado(cedula, sexo, nacimiento, apn, con_discapacidad=False):
        empleado = EmployeeModel.objects.create(
            cedulaidentidad=cedula,
            nombres=f'Nombre {cedula}',
            apellidos='Apellido',
            fecha_nacimiento=nacimiento,
            total_anos_apn=apn,
            sexoid=sexo,
        )
        AsigTrabajoModel.objects.create(
            employee=empleado,
            codigo=f'C-{cedula}',
            denominacioncargoid=cargo,
            denominacioncargoespecificoid=cargo_especifico,
            tiponominaid=nomina,
            estatusid=estatus,
            Dependencia=dependencia,
            DireccionGeneral=direccion,
            gradoid=grado,
        )
        perfil = PerfilSaludModel.objects.create(
            empleado=empleado, grupo_sanguineo=grupo_sanguineo)
        if con_discapacidad:
            PerfilSaludDiscapacidad.objects.create(
                perfil_salud=perfil, discapacidades=discapacidad)
        FormacionAcademicaModel.objects.create(empleado=empleado, nivel_academico=nivel)
        return empleado

    # 30 años, 12 años de APN, con discapacidad
    joven = crear_empleado('V100', femenino, datetime.date(1996, 6, 1), 12, con_discapacidad=True)
    # 50 años, 25 años de APN
    mayor = crear_empleado('V200', masculino, datetime.date(1976, 6, 1), 25)

    return {
        'femenino': femenino,
        'masculino': masculino,
        'nomina': nomina,
        'grado': grado,
        'cargo': cargo,
        'cargo_especifico': cargo_especifico,
        'dependencia': dependencia,
        'direccion': direccion,
        'grupo_sanguineo': grupo_sanguineo,
        'nivel': nivel,
        'discapacidad': discapacidad,
        'joven': joven,
        'mayor': mayor,
    }


def _generar(filtros=None, hoy=HOY):
    return generar_reporte_personal(
        RepoReportesORM(),
        filtros=filtros or {},
        registro=ReportFieldRegistryORM(),
        hoy=hoy,
    )


def _cedulas(reporte):
    return [fila['cedula'] for fila in reporte.filas]


def test_sin_filtros_devuelve_todos(escenario):
    assert sorted(_cedulas(_generar())) == ['V100', 'V200']


def test_filtros_de_estructura_y_nomina(escenario):
    assert _cedulas(_generar({'dependencia_id': escenario['dependencia'].pk})) == ['V100', 'V200']
    assert _cedulas(_generar({'nomina_id': escenario['nomina'].pk})) == ['V100', 'V200']
    assert _cedulas(_generar({'cargo_id': escenario['cargo'].pk})) == ['V100', 'V200']
    assert _cedulas(_generar({'grado_id': escenario['grado'].pk})) == ['V100', 'V200']
    assert _generar({'dependencia_id': 999999}).filas == []


def test_filtro_por_sexo(escenario):
    assert _cedulas(_generar({'sexo_id': escenario['femenino'].pk})) == ['V100']
    assert _cedulas(_generar({'sexo_id': escenario['masculino'].pk})) == ['V200']


def test_filtro_por_edad_se_convierte_a_fecha(escenario):
    # edad_min=40 deja fuera al de 30 años
    assert _cedulas(_generar({'edad_min': 40})) == ['V200']
    # edad_max=35 deja fuera al de 50 años
    assert _cedulas(_generar({'edad_max': 35})) == ['V100']


def test_filtro_por_anios_de_apn(escenario):
    assert _cedulas(_generar({'apn_min': 20})) == ['V200']
    assert _cedulas(_generar({'apn_max': 20})) == ['V100']


def test_filtro_por_grupo_sanguineo(escenario):
    assert sorted(_cedulas(_generar({'grupo_sanguineo_id': escenario['grupo_sanguineo'].pk}))) == [
        'V100', 'V200',
    ]
    assert _generar({'grupo_sanguineo_id': 999999}).filas == []


def test_filtro_por_discapacidad(escenario):
    assert _cedulas(_generar({'discapacidad_id': escenario['discapacidad'].pk})) == ['V100']


def test_filtro_por_nivel_academico(escenario):
    assert sorted(_cedulas(_generar({'nivel_academico_id': escenario['nivel'].pk}))) == [
        'V100', 'V200',
    ]
    assert _generar({'nivel_academico_id': 999999}).filas == []


def test_filtro_por_fecha_de_ingreso(escenario):
    from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel

    AntecedenteServicioModel.objects.create(
        empleado=escenario['joven'], fecha_ingreso=datetime.date(2020, 1, 1))
    assert _cedulas(_generar({'fecha_ingreso_Desde': '2019-01-01'})) == ['V100']
    assert _generar({'fecha_ingreso_Desde': '2021-01-01'}).filas == []


def test_tope_de_filas_configurable_y_avisado(escenario, settings):
    settings.REPORTES_MAX_FILAS = 1
    reporte = _generar()

    assert reporte.total_registros == 1
    assert reporte.metadatos['total_encontrados'] == 2
    assert reporte.metadatos['limite'] == 1
    assert reporte.metadatos['truncado'] is True


def test_sin_tope_cuando_el_setting_es_cero(escenario, settings):
    settings.REPORTES_MAX_FILAS = 0
    reporte = _generar()

    assert reporte.total_registros == 2
    assert reporte.metadatos['truncado'] is False


def test_conteo_agrupado_por_direccion_general(escenario):
    reporte = _generar({'tipo_reporte': 'conteo', 'agrupar_por': 'direccion_general'})

    assert reporte.columnas == ['direccion_general', 'total']
    assert reporte.filas == [{'direccion_general': 'OFICINA DE GESTION HUMANA', 'total': 2}]
    assert reporte.metadatos['agrupar_por'] == 'direccion_general'


def test_filtro_desconocido_lanza_error_de_validacion(escenario):
    with pytest.raises(ValidationError):
        _generar({'campo_inventado': '1'})


def test_un_empleado_con_dos_asignaciones_aparece_una_sola_vez(escenario):
    """Los filtros por estructura navegan `assignments`: `distinct()` evita filas repetidas."""
    joven = escenario['joven']
    AsigTrabajoModel.objects.create(
        employee=joven,
        codigo='C-V100-B',
        denominacioncargoid=escenario['cargo'],
        denominacioncargoespecificoid=escenario['cargo_especifico'],
        tiponominaid=escenario['nomina'],
        estatusid=EstatusModel.objects.get(estatus='ACTIVO'),
        Dependencia=escenario['dependencia'],
        DireccionGeneral=escenario['direccion'],
    )

    cedulas = _cedulas(_generar({'dependencia_id': escenario['dependencia'].pk}))
    assert cedulas.count('V100') == 1
    assert sorted(cedulas) == ['V100', 'V200']
