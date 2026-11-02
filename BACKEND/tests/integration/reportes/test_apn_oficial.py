"""
G9: paridad entre la antigüedad APN oficial en SQL y `calcular_total_apn`.

Casos: antecedentes cerrados, abiertos, días 31, febrero y fechas nulas.
También comprueba que los filtros y la columna del reporte usan la anotación
oficial y no la columna legada `Employee.total_anos_apn`.
"""
from datetime import date
from decimal import Decimal

import pytest

from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.personal.infrastructure.mappers.mapper_personal import (
    _total_anos_apn_calculado,
)
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.repositories.consultas_apn import (
    anotar_apn_oficial,
)
from apps.reportes.application.use_cases.generar_reportes import (
    generar_reporte_personal,
)
from apps.reportes.infrastructure.repositories.repo_reportes_orm import (
    RepoReportesORM,
)
from core.infrastructure.report_field_registry import ReportFieldRegistryORM

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalogo(db):
    NacionalidadModel.objects.get_or_create(
        id=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'}
    )
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'F'})
    return sexo


def empleado(cedula, sexo, legado=99):
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula,
        nombres='APN',
        apellidos=cedula,
        sexoid=sexo,
        total_anos_apn=legado,
    )


def antecedente(emp, inicio, fin):
    return AntecedenteServicioModel.objects.create(
        empleado=emp, fecha_ingreso=inicio, fecha_egreso=fin
    )


def _anotado(emp):
    return anotar_apn_oficial(
        EmployeeModel.objects.filter(pk=emp.pk)
    ).get().apn_oficial


def _reporte(filtros):
    return generar_reporte_personal(
        RepoReportesORM(),
        filtros=filtros,
        registro=ReportFieldRegistryORM(),
        puede_filtrar_estructura=True,
        limite=500,
    )


def test_paridad_sql_python_con_casos_variados(catalogo):
    emp = empleado('G9000001', catalogo)
    casos = [
        (date(2020, 1, 1), date(2020, 12, 31)),   # cierre normal
        (date(2020, 1, 31), date(2020, 3, 31)),   # día 31
        (date(2020, 2, 29), date(2021, 2, 28)),   # febrero / bisiesto
        (date(2020, 5, 1), None),                 # abierto: se ignora
        (date(2015, 6, 15), date(2018, 6, 14)),   # varios años
    ]
    for inicio, fin in casos:
        antecedente(emp, inicio, fin)

    esperado = _total_anos_apn_calculado(
        AntecedenteServicioModel.objects.filter(empleado=emp)
    )
    obtenido = float(_anotado(emp) or 0)

    assert obtenido == pytest.approx(esperado, abs=1e-4)


def test_la_columna_legada_no_altera_la_anotacion(catalogo):
    emp = empleado('G9000002', catalogo, legado=Decimal('99.99'))
    antecedente(emp, date(2010, 1, 1), date(2015, 1, 1))  # 5 años oficiales

    assert float(_anotado(emp) or 0) == pytest.approx(5.0027, abs=1e-4)


def test_filtros_apn_usan_el_valor_oficial_y_no_la_columna_legada(catalogo):
    joven = empleado('G9000010', catalogo, legado=Decimal('99'))
    mayor = empleado('G9000020', catalogo, legado=Decimal('0'))
    antecedente(joven, date(2010, 1, 1), date(2015, 1, 1))   # ~5
    antecedente(mayor, date(1990, 1, 1), date(2020, 1, 1))   # ~30

    assert [f['cedula'] for f in _reporte({'apn_min': 20}).filas] == ['G9000020']
    assert [f['cedula'] for f in _reporte({'apn_max': 10}).filas] == ['G9000010']


def test_la_columna_del_reporte_muestra_el_valor_oficial(catalogo):
    emp = empleado('G9000030', catalogo, legado=Decimal('99'))
    antecedente(emp, date(2010, 1, 1), date(2015, 1, 1))

    fila = next(f for f in _reporte({}).filas if f['cedula'] == 'G9000030')

    assert fila['total_anos_apn'] == pytest.approx(5.0027, abs=1e-4)
    assert 'total_anos_apn' in _reporte({}).columnas
