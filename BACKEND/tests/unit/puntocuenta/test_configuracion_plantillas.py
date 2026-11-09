"""
Tests unitarios de plantillas por tipo de movimiento, variables y diseño formal en Punto de Cuenta (O31).
Puros, sin llamadas de red ni dependencias de servicios externos.
"""
from datetime import date, datetime
from unittest.mock import patch
import unittest
from rest_framework.exceptions import ValidationError

from apps.puntocuenta.domain.services.variables_plantilla import (
    DICCIONARIO_VARIABLES,
    VARIABLES_PERMITIDAS,
    extraer_variables,
    formatear_fecha_larga,
    obtener_ayuda_variables,
    validar_variables_texto,
)
from apps.puntocuenta.infrastructure.pdf_punto_cuenta import (
    generar_vista_previa_pdf,
    resolver_plantilla_proceso,
    resolver_secciones_plantilla,
)
from apps.puntocuenta.infrastructure.serializers.punto_cuenta_lectura_serializers import (
    ActualizarConfiguracionPuntoCuentaSerializer,
    PlantillaProcesoSerializer,
)


def test_diccionario_variables_contiene_las_veintiun_variables_requeridas():
    esperadas = {
        'numero', 'fecha', 'fecha_larga', 'nombre', 'cedula',
        'cargo', 'cargo_destino', 'codigo_cargo', 'nivel', 'tipo_personal',
        'origen', 'destino', 'motivo', 'fecha_efectiva', 'fecha_ingreso',
        'anios_servicio', 'presentado_a', 'cargo_presentado_a',
        'presentado_por', 'cargo_presentado_por', 'unidad',
    }
    assert VARIABLES_PERMITIDAS == esperadas
    assert set(DICCIONARIO_VARIABLES.keys()) == esperadas

    ayuda = obtener_ayuda_variables()
    assert len(ayuda) == len(esperadas)
    tags = {item['tag'] for item in ayuda}
    assert tags == {f"{{{v}}}" for v in esperadas}


def test_formatear_fecha_larga_estandar_venezolano():
    assert formatear_fecha_larga('2026-11-05') == '5 de noviembre de 2026'
    assert formatear_fecha_larga('2026-01-01') == '1 de enero de 2026'
    assert formatear_fecha_larga(date(2026, 7, 24)) == '24 de julio de 2026'
    assert formatear_fecha_larga(datetime(2026, 12, 31, 10, 30)) == '31 de diciembre de 2026'


def test_validacion_variables_texto_acepta_permitidas_y_rechaza_desconocidas():
    texto_valido = (
        "El funcionario {nombre}, C.I. {cedula}, en cargo {cargo} pasa a {destino} "
        "en fecha {fecha} ({fecha_larga}), presentado por {presentado_por} ({unidad})."
    )
    assert validar_variables_texto(texto_valido) == []

    texto_invalido = "Funcionario {nombre} con sueldo {salario} y departamento {gerencia}."
    desconocidas = validar_variables_texto(texto_invalido)
    assert set(desconocidas) == {'salario', 'gerencia'}


def test_serializer_plantilla_proceso_valida_variables_desconocidas():
    ser_invalido = PlantillaProcesoSerializer(data={
        'personalizado': True,
        'titulo': 'PUNTO {invalido}',
        'asunto': 'Aviso {otra_invalida}',
        'exposicion': 'Cuerpo con {nombre}',
    })
    fallo = False
    try:
        ser_invalido.is_valid(raise_exception=True)
    except ValidationError as exc:
        fallo = True
        assert 'titulo' in exc.detail or 'asunto' in exc.detail
    assert fallo, "Se esperaba ValidationError por variables desconocidas"

    ser_valido = PlantillaProcesoSerializer(data={
        'personalizado': True,
        'titulo': 'PUNTO DE CUENTA - {motivo}',
        'asunto': 'Solicitud de traslado de {nombre} (C.I. {cedula})',
        'exposicion': 'Se traslada desde {origen} hacia {destino}. Punto N.º {numero}.',
        'propuesta': 'Autorizar traslado al cargo {cargo_destino}.',
        'presentado_a': '{presentado_a}',
        'cargo_presentado_a': '{cargo_presentado_a}',
        'presentado_por': '{presentado_por}',
        'cargo_presentado_por': '{cargo_presentado_por}',
        'unidad': '{unidad}',
        'incluir_tabla_resumen': False,
        'incluir_decision': True,
        'incluir_observaciones': True,
    })
    assert ser_valido.is_valid(), ser_valido.errors


def test_serializer_actualizar_rechaza_variables_en_plantilla_general_y_procesos():
    datos = {
        'titulo': 'Título con {variable_erronea}',
        'plantillas_procesos': {
            'cambio_oficina': {
                'personalizado': True,
                'exposicion': '{nombre} se traslada',
            }
        }
    }
    ser = ActualizarConfiguracionPuntoCuentaSerializer(data=datos)
    assert not ser.is_valid()
    assert 'titulo' in ser.errors


def test_resolver_secciones_plantilla_proceso_fallback_y_personalizada():
    cfg = {
        'titulo': 'TITULO GENERAL',
        'asunto': 'ASUNTO GENERAL {nombre}',
        'exposicion': 'EXPOSICION GENERAL {cargo}',
        'propuesta': 'PROPUESTA GENERAL {destino}',
        'incluir_tabla_resumen': False,
        'plantillas_procesos': {
            'cambio_oficina': {
                'personalizado': True,
                'asunto': 'ASUNTO TRASLADO {nombre}',
                'exposicion': 'EXPOSICION TRASLADO {origen} a {destino}',
                'propuesta': 'PROPUESTA TRASLADO',
                'incluir_tabla_resumen': True,
            },
            'cambio_nivel': {
                'personalizado': False,
                'asunto': 'NO USAR',
            }
        }
    }

    # Proceso personalizado
    sec_traslado = resolver_secciones_plantilla(cfg, 'cambio_oficina')
    assert sec_traslado['asunto'] == 'ASUNTO TRASLADO {nombre}'
    assert sec_traslado['incluir_tabla_resumen'] is True

    # Proceso no personalizado (hereda general)
    sec_nivel = resolver_secciones_plantilla(cfg, 'cambio_nivel')
    assert sec_nivel['asunto'] == 'ASUNTO GENERAL {nombre}'
    assert sec_nivel['incluir_tabla_resumen'] is False

    # Compatibilidad con tupla tradicional
    t, e, c = resolver_plantilla_proceso(cfg, 'cambio_oficina')
    assert t == 'TITULO GENERAL'


def test_generar_vista_previa_pdf_con_secciones_formales():
    cfg = {
        'titulo': 'PUNTO DE CUENTA FORMAL',
        'asunto': 'Solicitud de asignación de {nombre}',
        'exposicion': 'Se expone el caso del trabajador {nombre} titular de {cedula} adscrito a {origen}.',
        'propuesta': 'Se propone su traslado a {destino} en el cargo de {cargo_destino}.',
        'base_legal': 'Conforme al Estatuto de la Función Pública.',
        'presentado_a': 'Director General',
        'cargo_presentado_a': 'Director General de CONATEL',
        'presentado_por': 'Gerente de Gestión Humana',
        'cargo_presentado_por': 'Gerente de RRHH',
        'unidad': 'Gerencia de Gestión Humana',
        'incluir_decision': True,
        'incluir_observaciones': True,
        'incluir_tabla_resumen': False,
        'firmas': [
            {'cargo': 'Gerente de RRHH', 'nombre': 'Lic. María Contreras'},
            {'cargo': 'Director General', 'nombre': 'May. Jorge Márquez'},
        ],
    }
    with patch('apps.puntocuenta.infrastructure.pdf_punto_cuenta.construir_config_pdf') as mock_cfg:
        mock_cfg.return_value = {
            'tipo_cintillo': 'INSTITUCIONAL',
            'logo_principal_bytes': None,
            'logo_secundario_bytes': None,
            'nombre_institucion': 'CONATEL',
            'subtitulo': 'Gestión del Talento Humano',
            'mostrar_fecha': True,
            'mostrar_paginacion': True,
        }
        pdf_bytes = generar_vista_previa_pdf(cfg, proceso='cambio_oficina')
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b'%PDF-')
