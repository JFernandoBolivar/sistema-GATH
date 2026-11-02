"""
Preparación de los filtros del reporte de personal (G3), sin BD ni Django.

Cubre: los ~30 filtros del formulario llegan al registro como lookups, la
conversión de edad/APN/fechas, el rechazo de filtros desconocidos (400 y no
descarte silencioso), los **valores extremos** (que antes daban 500), la
validación de rangos, `agrupar_por`/`tipo_reporte` y el permiso de estructura
organizativa (M7).
"""
from datetime import date
from decimal import Decimal

import pytest

from apps.reportes.domain.services.filtros_reporte_personal import (
    EDAD_MAXIMA_PERMITIDA,
    EDAD_MINIMA_PERMITIDA,
    ENTERO_MAXIMO_EXCLUSIVO,
    preparar_consulta_personal,
)
from core.domain.exceptions import PermissionDeniedError, ValidationError
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

    consulta = preparar_consulta_personal(
        filtros, configuracion, puede_filtrar_estructura=True, hoy=HOY
    )

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
        'total_anos_apn__gte': Decimal('5'),
        'total_anos_apn__lte': Decimal('20'),
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


# ─── A1: valores extremos → 400, nunca 500 ────────────────────────────────────


@pytest.mark.parametrize(
    'edad',
    ['3000', str(EDAD_MAXIMA_PERMITIDA + 1), '-1', '99999999999999999999'],
)
def test_edad_fuera_de_rango_falla(configuracion, edad):
    with pytest.raises(ValidationError) as exc:
        preparar_consulta_personal({'edad_min': edad}, configuracion, hoy=HOY)
    assert 'edad_min' in str(exc.value)


def test_edad_en_los_limites_se_acepta(configuracion):
    minima = preparar_consulta_personal(
        {'edad_min': str(EDAD_MINIMA_PERMITIDA)}, configuracion, hoy=HOY
    )
    maxima = preparar_consulta_personal(
        {'edad_min': str(EDAD_MAXIMA_PERMITIDA)}, configuracion, hoy=HOY
    )
    assert minima.lookups == {'fecha_nacimiento__lte': HOY}
    assert maxima.lookups == {'fecha_nacimiento__lte': date(1876, 10, 30)}


def test_edad_con_anio_negativo_no_revienta(configuracion):
    """Antes `_restar_anios` levantaba ValueError (500) con 3000."""
    with pytest.raises(ValidationError):
        preparar_consulta_personal({'edad_max': '3000'}, configuracion, hoy=HOY)


def test_restar_anios_con_anio_imposible_da_error_de_validacion():
    """La guarda de `_restar_anios` cubre años fuera del rango de `date`."""
    from apps.reportes.domain.services.filtros_reporte_personal import _restar_anios

    with pytest.raises(ValidationError):
        _restar_anios(date(2026, 10, 30), 3000)


@pytest.mark.parametrize('valor', ['NaN', 'sNaN', 'Infinity', '-Infinity'])
def test_decimal_no_finito_falla(configuracion, valor):
    with pytest.raises(ValidationError) as exc:
        preparar_consulta_personal({'apn_min': valor}, configuracion, hoy=HOY)
    assert 'apn_min' in str(exc.value)


def test_decimal_fuera_de_rango_falla(configuracion):
    with pytest.raises(ValidationError):
        preparar_consulta_personal({'apn_min': '1e999'}, configuracion, hoy=HOY)


def test_decimal_valido_se_convierte(configuracion):
    consulta = preparar_consulta_personal({'apn_min': '5.5'}, configuracion, hoy=HOY)
    assert consulta.lookups == {'total_anos_apn__gte': Decimal('5.5')}


@pytest.mark.parametrize('valor', ['1_0', '10.0', '0x10', '1e3', '-5', '0'])
def test_identificador_invalido_falla(configuracion, valor):
    with pytest.raises(ValidationError):
        preparar_consulta_personal({'sexo_id': valor}, configuracion, hoy=HOY)


@pytest.mark.parametrize(
    'valor',
    [
        '١٢٣',  # dígitos arábigo-índicos: `str.isdigit()` los acepta, `int()` también
        '１２３',  # dígitos de ancho completo
        '³',  # superíndice: es dígito Unicode, no decimal
    ],
)
def test_identificador_con_digitos_no_ascii_falla(configuracion, valor):
    """B5/revisión: solo dígitos ASCII cuentan como identificador."""
    with pytest.raises(ValidationError) as exc:
        preparar_consulta_personal({'sexo_id': valor}, configuracion, hoy=HOY)
    assert 'sexo_id' in str(exc.value)


def test_entero_de_miles_de_digitos_no_revienta(configuracion):
    """`int()` lanza ValueError con cadenas de más de ~4300 dígitos: debe ser 400."""
    with pytest.raises(ValidationError):
        preparar_consulta_personal({'sexo_id': '9' * 5000}, configuracion, hoy=HOY)


def test_identificador_en_el_limite_superior_del_int4_falla(configuracion):
    with pytest.raises(ValidationError) as exc:
        preparar_consulta_personal(
            {'sexo_id': str(ENTERO_MAXIMO_EXCLUSIVO)}, configuracion, hoy=HOY
        )
    assert 'sexo_id' in str(exc.value)


def test_identificador_en_el_limite_superior_valido_se_acepta(configuracion):
    consulta = preparar_consulta_personal(
        {'sexo_id': str(ENTERO_MAXIMO_EXCLUSIVO - 1)}, configuracion, hoy=HOY
    )
    assert consulta.lookups == {'sexoid': ENTERO_MAXIMO_EXCLUSIVO - 1}


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
    """B6: el mensaje lo produce la entidad, no el servicio."""
    with pytest.raises(ValidationError) as exc:
        preparar_consulta_personal({'tipo_reporte': 'resumen'}, configuracion, hoy=HOY)
    assert 'Tipo de reporte no válido' in str(exc.value)


def test_agrupacion_inexistente_falla(configuracion):
    with pytest.raises(ValidationError):
        preparar_consulta_personal({'agrupar_por': 'estatura'}, configuracion, hoy=HOY)


def test_lista_con_agrupacion_resuelve_la_ruta_del_grupo(configuracion):
    consulta = preparar_consulta_personal(
        {'agrupar_por': 'tipo_nomina', 'tipo_reporte': 'lista'}, configuracion, hoy=HOY
    )
    assert consulta.agrupar_por_ruta == 'assignments__tiponominaid__nomina'


def test_las_agrupaciones_por_cargo_grado_usan_el_texto_del_catalogo(configuracion):
    """M3: agrupar no debe devolver IDs de FK en el PDF."""
    campos = configuracion['campos_permitidos']
    assert campos['cargo'] == 'assignments__denominacioncargoid__cargo'
    assert campos['cargo_especifico'] == 'assignments__denominacioncargoespecificoid__cargo'
    assert campos['grado'] == 'assignments__gradoid__grado'


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


# ─── M7: la estructura organizativa exige permiso en el servidor ──────────────


@pytest.mark.parametrize(
    'filtro',
    [
        {'dependencia_id': '1'},
        {'direccion_general_id': '2'},
        {'direccion_linea_id': '3'},
        {'coordinacion_id': '4'},
    ],
)
def test_filtros_de_estructura_sin_permiso_dan_403(configuracion, filtro):
    with pytest.raises(PermissionDeniedError) as exc:
        preparar_consulta_personal(
            filtro, configuracion, puede_filtrar_estructura=False, hoy=HOY
        )
    assert 'estructura organizativa' in str(exc.value)


def test_filtros_de_estructura_con_permiso_pasan(configuracion):
    consulta = preparar_consulta_personal(
        {'dependencia_id': '1'}, configuracion, puede_filtrar_estructura=True, hoy=HOY
    )
    assert consulta.lookups == {'assignments__Dependencia': 1}


def test_otros_filtros_pasan_sin_el_permiso_de_estructura(configuracion):
    consulta = preparar_consulta_personal(
        {'sexo_id': '2'}, configuracion, puede_filtrar_estructura=False, hoy=HOY
    )
    assert consulta.lookups == {'sexoid': 2}
