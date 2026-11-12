"""
Cada filtro del formulario de `/pasivos/reportes` llega al reporte y EXCLUYE
lo que debe. Complementa `test_filtros_todos_los_reportes.py` con los filtros
que ahí no se probaban para pasivos: grado, cargo específico, organismo,
estructura, salud, formación, fechas de ingreso, vivienda y formación
complementaria. También verifica el total por sexo del PDF.
"""
import datetime

import pytest

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel, DenominacionCargoEspecificoModel, DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel, GradoModel, NacionalidadModel, PaisModel, SexoModel,
    TipoNominaModel, TipoPersonalModel, TipoProcedenciaModel,
)
from apps.catalogos.infrastructure.models.geografia_models import (
    EstadoModel, MunicipioModel, ParroquiaModel, RegionModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel, DependenciaModel, DireccionGeneralModel, DireccionLineaModel,
    OrganismoAdscritoModel,
)
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    CapacitacionModel, CarreraModel, CategoriaDiscapacidadModel, CategoriaPatologiaModel,
    CondicionViviendaModel, DiscapacidadModel, GrupoCapacitacionModel, GrupoSanguineoModel,
    MencionModel, NivelAcademicoModel, PatologiaCronicaModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel, DatosViviendaModel, FormacionAcademicaModel,
    FormacionComplementariaModel, PerfilSaludDiscapacidad, PerfilSaludModel,
    PerfilSaludPatologia,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.reportes.application.use_cases.generar_reportes import generar_reporte_pasivos_actuales
from apps.reportes.infrastructure.repositories.repo_reportes_orm import RepoReportesORM
from core.infrastructure.pdf import pdf_components
from core.infrastructure.pdf.report_pdf import generar_reporte_pdf
from core.infrastructure.report_field_registry import ReportFieldRegistryORM

pytestmark = pytest.mark.django_db

HOY = datetime.date(2026, 10, 30)
P1, P2 = 'V301', 'V302'


@pytest.fixture
def d():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    o = {}
    o['F'] = SexoModel.objects.create(sexo='F')
    o['M'] = SexoModel.objects.create(sexo='M')
    o['activo'] = EstatusModel.objects.create(estatus='ACTIVO')
    o['tp'] = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    o['pen'] = TipoNominaModel.objects.create(nomina='PENSIONADO', es_activo=False)
    o['jub'] = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)
    o['pais'] = (PaisModel.objects.create(nombre='VENEZUELA', codigo='VEN'),
                 PaisModel.objects.create(nombre='ESPANA', codigo='ESP'))
    o['g'] = (GradoModel.objects.create(grado='G1'), GradoModel.objects.create(grado='G2'))
    o['esp'] = (DenominacionCargoEspecificoModel.objects.create(cargo='ESP1'),
                DenominacionCargoEspecificoModel.objects.create(cargo='ESP2'))
    o['cargo'] = (DenominacionCargoModel.objects.create(cargo='CAR1'),
                  DenominacionCargoModel.objects.create(cargo='CAR2'))
    o['org'] = (OrganismoAdscritoModel.objects.create(Organismoadscrito='ORG1'),
                OrganismoAdscritoModel.objects.create(Organismoadscrito='ORG2'))
    o['dep'] = (DependenciaModel.objects.create(Codigo='D1', dependencia='DEP1'),
                DependenciaModel.objects.create(Codigo='D2', dependencia='DEP2'))
    o['dg'] = tuple(DireccionGeneralModel.objects.create(
        Codigo=f'DG{i}', direccion_general=f'DG{i}', dependenciaId=o['dep'][i - 1]) for i in (1, 2))
    o['dl'] = tuple(DireccionLineaModel.objects.create(
        Codigo=f'L{i}', direccion_linea=f'L{i}', direccionGeneral=o['dg'][i - 1]) for i in (1, 2))
    o['co'] = tuple(CoordinacionModel.objects.create(
        Codigo=f'C{i}', coordinacion=f'C{i}', direccionLinea=o['dl'][i - 1]) for i in (1, 2))

    sang = (GrupoSanguineoModel.objects.create(GrupoSanguineo='O+'),
            GrupoSanguineoModel.objects.create(GrupoSanguineo='A+'))
    disc = DiscapacidadModel.objects.create(
        discapacidad='MOTORA', categoria=CategoriaDiscapacidadModel.objects.create(nombre_categoria='FIS'))
    pato = PatologiaCronicaModel.objects.create(
        patologia='ASMA', categoria=CategoriaPatologiaModel.objects.create(nombre_categoria='CRO'))
    niv = (NivelAcademicoModel.objects.create(nivelacademico='SUP'),
           NivelAcademicoModel.objects.create(nivelacademico='TEC'))
    carr = (CarreraModel.objects.create(nombre_carrera='ING'),
            CarreraModel.objects.create(nombre_carrera='DER'))
    menc = (MencionModel.objects.create(carrera_id=carr[0], nombre_mencion='SIS'),
            MencionModel.objects.create(carrera_id=carr[1], nombre_mencion='PEN'))
    reg = (RegionModel.objects.create(region='R1'), RegionModel.objects.create(region='R2'))
    est = tuple(EstadoModel.objects.create(estado=f'E{i}', Region=reg[i - 1]) for i in (1, 2))
    mun = tuple(MunicipioModel.objects.create(municipio=f'M{i}', estadoid=est[i - 1]) for i in (1, 2))
    par = tuple(ParroquiaModel.objects.create(parroquia=f'P{i}', municipioid=mun[i - 1]) for i in (1, 2))
    cond = (CondicionViviendaModel.objects.create(condicion='PROPIA'),
            CondicionViviendaModel.objects.create(condicion='ALQUILADA'))
    cap = (CapacitacionModel.objects.create(nombre_capacitacion='CAP1'),
           CapacitacionModel.objects.create(nombre_capacitacion='CAP2'))
    proc = (TipoProcedenciaModel.objects.create(tipo_procedencia='INTERNA'),
            TipoProcedenciaModel.objects.create(tipo_procedencia='EXTERNA'))
    grp = (GrupoCapacitacionModel.objects.create(nombre_grupo='GR1'),
           GrupoCapacitacionModel.objects.create(nombre_grupo='GR2'))

    datos = [
        (P1, datetime.date(1950, 1, 1), datetime.date(1980, 1, 1)),
        (P2, datetime.date(1965, 1, 1), datetime.date(2005, 1, 1)),
    ]
    for i, (cedula, nacimiento, ingreso) in enumerate(datos):
        emp = EmployeeModel.objects.create(
            cedulaidentidad=cedula, nombres=f'N{cedula}', apellidos=f'A{cedula}',
            fecha_nacimiento=nacimiento, sexoid=o['F'] if i == 0 else o['M'], total_anos_apn=0)
        AsigTrabajoModel.objects.create(
            employee=emp, codigo=f'C{cedula}', denominacioncargoid=o['cargo'][i],
            denominacioncargoespecificoid=o['esp'][i], tiponominaid=o['pen'] if i == 0 else o['jub'],
            estatusid=o['activo'], Dependencia=o['dep'][i], DireccionGeneral=o['dg'][i],
            DireccionLinea=o['dl'][i], Coordinacion=o['co'][i], OrganismoAdscritoid=o['org'][i],
            gradoid=o['g'][i], Tipo_personal=o['tp'])
        AntecedenteServicioModel.objects.create(
            empleado=emp, fecha_ingreso=ingreso, fecha_egreso=ingreso.replace(year=ingreso.year + 10))
        perfil = PerfilSaludModel.objects.create(empleado=emp, grupo_sanguineo=sang[i])
        if i == 0:
            PerfilSaludDiscapacidad.objects.create(perfil_salud=perfil, discapacidades=disc)
            PerfilSaludPatologia.objects.create(perfil_salud=perfil, patologias_cronicas=pato)
        FormacionAcademicaModel.objects.create(
            empleado=emp, nivel_academico=niv[i], carrera=carr[i], mencion=menc[i])
        DatosViviendaModel.objects.create(
            empleado=emp, estado=est[i], municipio=mun[i], parroquia=par[i],
            direccion_exacta='x', condicion_vivienda=cond[i], pais=o['pais'][i])
        FormacionComplementariaModel.objects.create(
            empleado=emp, capacitacion=cap[i], procedencia=proc[i], grupo=grp[i])
    o.update(sang=sang, disc=disc, pato=pato, niv=niv, carr=carr, menc=menc, reg=reg, est=est,
             mun=mun, par=par, cond=cond, cap=cap, proc=proc, grp=grp)
    return o


def _pasivos(f):
    return generar_reporte_pasivos_actuales(
        RepoReportesORM(), filtros=f, registro=ReportFieldRegistryORM(),
        puede_filtrar_estructura=True, limite=5000, hoy=HOY)


def _ced(rep):
    return sorted(f['cedula'] for f in rep.filas)


def test_pasivos_sin_filtros_trae_ambos(d):
    assert _ced(_pasivos({})) == [P1, P2]


def test_pasivos_filtros_del_formulario_excluyen_lo_que_no_coincide(d):
    casos = [
        ({'grado_id': d['g'][0].pk}, [P1]),
        ({'grado_id': d['g'][1].pk}, [P2]),
        ({'cargo_especifico_id': d['esp'][1].pk}, [P2]),
        ({'OrganismoAdscrito_id': d['org'][0].pk}, [P1]),
        ({'dependencia_id': d['dep'][1].pk}, [P2]),
        ({'direccion_general_id': d['dg'][0].pk}, [P1]),
        ({'direccion_linea_id': d['dl'][1].pk}, [P2]),
        ({'coordinacion_id': d['co'][0].pk}, [P1]),
        ({'grupo_sanguineo_id': d['sang'][1].pk}, [P2]),
        ({'discapacidad_id': d['disc'].pk}, [P1]),
        ({'patologia_id': d['pato'].pk}, [P1]),
        ({'nivel_academico_id': d['niv'][1].pk}, [P2]),
        ({'carrera_id': d['carr'][0].pk}, [P1]),
        ({'mencion_id': d['menc'][1].pk}, [P2]),
        ({'fecha_ingreso_Desde': '2000-01-01'}, [P2]),
        ({'fecha_ingreso_Hasta': '2000-01-01'}, [P1]),
        ({'region_id': d['reg'][1].pk}, [P2]),
        ({'estado_id': d['est'][0].pk}, [P1]),
        ({'municipio_id': d['mun'][1].pk}, [P2]),
        ({'parroquia_id': d['par'][0].pk}, [P1]),
        ({'condicion_vivienda_id': d['cond'][1].pk}, [P2]),
        ({'pais_id': d['pais'][0].pk}, [P1]),
        ({'pais_id': d['pais'][1].pk}, [P2]),
        ({'capacitacion_id': d['cap'][0].pk}, [P1]),
        ({'procedencia_id': d['proc'][1].pk}, [P2]),
        ({'grupo_id': d['grp'][0].pk}, [P1]),
        ({'nomina_id': d['jub'].pk}, [P2]),
        ({'pais_id': d['pais'][0].pk, 'estado_id': d['est'][1].pk}, []),
    ]
    for filtros, esperado in casos:
        assert _ced(_pasivos(filtros)) == esperado, filtros


def test_pasivos_filas_traen_sexo_para_el_total_del_pdf(d):
    assert {f['cedula']: f['sexo'] for f in _pasivos({}).filas} == {P1: 'F', P2: 'M'}
    assert [f['sexo'] for f in _pasivos({'sexo_id': d['M'].pk}).filas] == ['M']


def test_pdf_de_pasivos_totaliza_por_sexo(monkeypatch):
    capturado = {}
    original = pdf_components.create_stats_box

    def espia(stats, width=None):
        capturado.update(stats)
        return original(stats, width=width)

    monkeypatch.setattr(pdf_components, 'create_stats_box', espia)
    columnas = ['#', 'cedula', 'nombres', 'apellidos', 'tipo_pasivo', 'pais', 'fecha_egreso', 'contacto']
    base = {c: '' for c in columnas}
    filas = [{**base, 'sexo': 'F'}, {**base, 'sexo': 'F'}, {**base, 'sexo': 'M'}, {**base, 'sexo': ''}]
    assert generar_reporte_pdf('Reporte de Personal Pasivo', columnas, filas).startswith(b'%PDF')
    assert capturado == {'Total Pasivos': 4, 'Masculino': 1, 'Femenino': 2}
