"""
Preparación de los filtros del reporte de personal (G3), sin BD ni Django.

Cubre: los ~30 filtros del formulario llegan al registro como lookups, la
conversión de edad/APN/fechas, el rechazo de filtros desconocidos (400 y no
descarte silencioso), la validación de rangos, y `agrupar_por`/`tipo_reporte`.
"""
from datetime import date

import pytest

from apps.reportes.domain.services.filtros_reporte_personal import (
    preparar_consulta_personal,
)
from core.domain.exceptions import ValidationError
from core.infrastructure.report_field_registry import ReportFieldRegistryORM

HOY = date(2026, 10, 30)


@pytest.fixture
def configuracion():
    return ReportFieldRegistryORM().configuracion('empleados')


def test_sin_filtros_no_produce_lookups(configuracion):
    consulta = preparar_consulta_personal({}, configuracion, hoy=HOY)
    assert consulta.lookups == {}
    assert consulta.tipo_reporte == 'lista'
    assert consulta.agrupar_por is None


def test_todos_los_filtros_del_formulario_se_traducen(configuracion):
    """Contrato UI→backend: ninguna clave del formulario se ignora en silencio."""
    filtros = {
        'dependencia_id': '3',
        'direccion_general_id': '4',
        'direccion_linea_id': '5',
        'coordinacion_id': '6',
        'sexo_id': '2',
        'discapacidad_id': '7',
        'grupo_sanguineo_id': '8',
        'patologia_id': '9',
        'nomina_id': '10',
        'grado_id': '11',
        'cargo_id': '12',
        'cargo_especifico_id': '13',
        'OrganismoAdscrito_id': '14',
        'nivel_academico_id': '15',
        'carrera_id': '16',
        'mencion_id': '17',
        'apn_min': '5',
        'apn_max': '20',
        'edad_min': '30',
        'edad_max': '50',
        'fecha_ingreso_Desde': '2010-01-01',
        'fecha_ingreso_Hasta': '2020-12-31',
        'region_id': '18',
        'estado_id': '19',
        'municipio_id': '20',
        'parroquia_id': '21',
        'condicion_vivienda_id': '22',
        'capacitacion_id': '23',
        'procedencia_id': '24',
        'grupo_id': '25',
    }

    consulta = preparar_consulta_personal(filtros, configuracion, hoy=HOY)

    esperados = {
        'assignments__Dependencia': 3,
        'assignments__DireccionGeneral': 4,
        'assignments__DireccionLinea': 5,
        'assignments__Coordinacion': 6,
        'sexoid': 2,
        'perfil_salud__discapacidad': 7,
        'perfil_salud__grupo_sanguineo': 8,
        'perfil_salud__patologiaCronica': 9,
        'assignments__tiponominaid': 10,
        'assignments__gradoid': 11,
        'assignments__denominacioncargoid': 12,
        'assignments__denominacioncargoespecificoid': 13,
        'assignments__OrganismoAdscritoid': 14,
        'formacion_academica__nivel_academico': 15,
        'formacion_academica__carrera': 16,
        'formacion_academica__mencion': 17,
        'total_anos_apn__gte': 5,
        'total_anos_apn__lte': 20,
        'fecha_nacimiento__lte': date(1996, 10, 30),
        'fecha_nacimiento__gte': date(1975, 10, 31),
        'antecedentes_servicio__fecha_ingreso__gte': date(2010, 1, 1),
        'antecedentes_servicio__fecha_ingreso__lte': date(2020, 12, 31),
        'datos_vivienda__estado__Region': 18,
        'datos_vivienda__estado': 19,
        'datos_vivienda__municipio': 20,
        'datos_vivienda__parroquia': 21,
        'datos_vivienda__condicion_vivienda': 22,
        'formacion_complementaria__capacitacion': 23,
        'formacion_complementaria__procedencia': 24,
        'formacion_complementaria__grupo': 25,
    }
    assert consulta.lookups == esperados


def test_filtro_desconocido_falla_en_vez_de_ignorarse(configuracion):
    with pytest.raises(ValidationError) as exc:
        preparar_consulta_personal({'rango_salarial': 'x'}, configuracion, hoy=HOY)
    assert 'rango_salarial' in str(exc.value)


def test_valor_no_numerico_falla(configuracion):
    with pytest.raises(ValidationError):
        preparar_consulta_personal({'sexo_id': 'femenino'}, configuracion, hoy=HOY)


def test_fecha_invalida_falla(configuracion):
    with pytest.raises(ValidationError):
        preparar_consulta_personal(
            {'fecha_ingreso_Desde': 'ayer'}, configuracion, hoy=HOY
        )


def test_rango_invertido_falla(configuracion):
    with pytest.raises(ValidationError):
        preparar_consulta_personal(
            {
                'fecha_ingreso_Desde': '2021-01-01',
                'fecha_ingreso_Hasta': '2020-01-01',
            },
            configuracion,
            hoy=HOY,
        )


def test_fecha_ingreso_y_fecha_apn_se_combinan_por_interseccion(configuracion):
    """Ambas claves comparten ruta en el registro: no deben pisarse."""
    consulta = preparar_consulta_personal(
        {
            'fecha_ingreso_Desde': '2015-01-01',
            'fecha_apn_Desde': '2010-01-01',
            'fecha_ingreso_Hasta': '2020-01-01',
            'fecha_apn_Hasta': '2022-01-01',
        },
        configuracion,
        hoy=HOY,
    )
    assert consulta.lookups['antecedentes_servicio__fecha_ingreso__gte'] == date(2015, 1, 1)
    assert consulta.lookups['antecedentes_servicio__fecha_ingreso__lte'] == date(2020, 1, 1)


def test_edad_min_se_convierte_a_fecha_de_nacimiento(configuracion):
    consulta = preparar_consulta_personal({'edad_min': '40'}, configuracion, hoy=HOY)
    assert consulta.lookups == {'fecha_nacimiento__lte': date(1986, 10, 30)}


def test_edad_min_en_29_de_febrero(configuracion):
    consulta = preparar_consulta_personal(
        {'edad_min': '1'}, configuracion, hoy=date(2028, 2, 29)
    )
    assert consulta.lookups == {'fecha_nacimiento__lte': date(2027, 2, 28)}


def test_tipo_reporte_conteo_exige_agrupacion(configuracion):
    with pytest.raises(ValidationError):
        preparar_consulta_personal({'tipo_reporte': 'conteo'}, configuracion, hoy=HOY)


def test_tipo_reporte_conteo_resuelve_la_ruta_de_agrupacion(configuracion):
    consulta = preparar_consulta_personal(
        {'tipo_reporte': 'conteo', 'agrupar_por': 'direccion_general'},
        configuracion,
        hoy=HOY,
    )
    assert consulta.tipo_reporte == 'conteo'
    assert consulta.agrupar_por == 'direccion_general'
    assert consulta.agrupar_por_ruta == 'assignments__DireccionGeneral__direccion_general'


def test_tipo_reporte_invalido_falla(configuracion):
    with pytest.raises(ValidationError):
        preparar_consulta_personal({'tipo_reporte': 'resumen'}, configuracion, hoy=HOY)


def test_agrupacion_inexistente_falla(configuracion):
    with pytest.raises(ValidationError):
        preparar_consulta_personal({'agrupar_por': 'estatura'}, configuracion, hoy=HOY)


def test_lista_con_agrupacion_resuelve_la_ruta_del_grupo(configuracion):
    consulta = preparar_consulta_personal(
        {'agrupar_por': 'tipo_nomina', 'tipo_reporte': 'lista'}, configuracion, hoy=HOY
    )
    assert consulta.agrupar_por_ruta == 'assignments__tiponominaid__nomina'


def test_las_claves_de_control_no_son_filtros(configuracion):
    consulta = preparar_consulta_personal(
        {
            'categoria': 'empleados',
            'formato': 'pdf',
            'agrupar_por': 'direccion_general',
            'tipo_reporte': 'lista',
        },
        configuracion,
        hoy=HOY,
    )
    assert consulta.lookups == {}
