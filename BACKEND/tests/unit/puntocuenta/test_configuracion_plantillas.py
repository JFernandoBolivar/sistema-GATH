"""
Tests unitarios de plantillas por tipo de movimiento y validación de variables en Punto de Cuenta.
Puros, sin llamadas de red ni dependencias de servicios externos.
"""
from unittest.mock import patch
import unittest
from rest_framework.exceptions import ValidationError

from apps.puntocuenta.domain.services.variables_plantilla import (
    DICCIONARIO_VARIABLES,
    VARIABLES_PERMITIDAS,
    extraer_variables,
    obtener_ayuda_variables,
    validar_variables_texto,
)
from apps.puntocuenta.infrastructure.pdf_punto_cuenta import (
    generar_vista_previa_pdf,
    resolver_plantilla_proceso,
)
from apps.puntocuenta.infrastructure.serializers.punto_cuenta_lectura_serializers import (
    ActualizarConfiguracionPuntoCuentaSerializer,
    PlantillaProcesoSerializer,
)


def test_diccionario_variables_contiene_las_ocho_variables_requeridas():
    esperadas = {'nombre', 'cedula', 'cargo', 'origen', 'destino', 'fecha', 'motivo', 'numero'}
    assert VARIABLES_PERMITIDAS == esperadas
    assert set(DICCIONARIO_VARIABLES.keys()) == esperadas

    ayuda = obtener_ayuda_variables()
    assert len(ayuda) == 8
    tags = {item['tag'] for item in ayuda}
    assert tags == {f"{{{v}}}" for v in esperadas}


def test_validacion_variables_texto_acepta_permitidas_y_rechaza_desconocidas():
    texto_valido = "El funcionario {nombre}, C.I. {cedula}, pasa a {destino} en fecha {fecha}."
    assert validar_variables_texto(texto_valido) == []

    texto_invalido = "Funcionario {nombre} con sueldo {salario} y departamento {gerencia}."
    desconocidas = validar_variables_texto(texto_invalido)
    assert set(desconocidas) == {'salario', 'gerencia'}


def test_serializer_plantilla_proceso_valida_variables_desconocidas():
    ser_invalido = PlantillaProcesoSerializer(data={
        'personalizado': True,
        'titulo': 'PUNTO {invalido}',
        'encabezado': 'Aviso {otra_invalida}',
        'cuerpo': 'Cuerpo con {nombre}',
    })
    fallo = False
    try:
        ser_invalido.is_valid(raise_exception=True)
    except ValidationError as exc:
        fallo = True
        assert 'titulo' in exc.detail or 'encabezado' in exc.detail
    assert fallo, "Se esperaba ValidationError por variables desconocidas"

    ser_valido = PlantillaProcesoSerializer(data={
        'personalizado': True,
        'titulo': 'PUNTO DE CUENTA - {motivo}',
        'encabezado': 'Notificación de {nombre}',
        'cuerpo': 'Se traslada desde {origen} hacia {destino}. Punto N.º {numero}.',
    })
    assert ser_valido.is_valid(), ser_valido.errors


def test_serializer_actualizar_rechaza_variables_en_plantilla_general_y_procesos():
    datos = {
        'titulo': 'Título con {variable_erronea}',
        'plantillas_procesos': {
            'cambio_oficina': {
                'personalizado': True,
                'cuerpo': '{nombre} se traslada',
            }
        }
    }
    ser = ActualizarConfiguracionPuntoCuentaSerializer(data=datos)
    assert not ser.is_valid()
    assert 'titulo' in ser.errors


def test_resolver_plantilla_fallback_a_general_cuando_no_esta_personalizado():
    cfg = {
        'titulo': 'TITULO GENERAL',
        'encabezado': 'ENCABEZADO GENERAL',
        'cuerpo': 'CUERPO GENERAL {nombre}',
        'plantillas_procesos': {
            'cambio_oficina': {
                'personalizado': False,
                'titulo': 'NO DEBE USARSE',
                'encabezado': 'TAMPOCO',
                'cuerpo': 'TAMPOCO',
            }
        }
    }
    t, e, c = resolver_plantilla_proceso(cfg, 'cambio_oficina')
    assert t == 'TITULO GENERAL'
    assert e == 'ENCABEZADO GENERAL'
    assert c == 'CUERPO GENERAL {nombre}'

    # Proceso inexistente también usa general
    t2, e2, c2 = resolver_plantilla_proceso(cfg, 'egreso_activo')
    assert t2 == 'TITULO GENERAL'
    assert e2 == 'ENCABEZADO GENERAL'
    assert c2 == 'CUERPO GENERAL {nombre}'


def test_resolver_plantilla_usa_personalizada_cuando_esta_habilitada():
    cfg = {
        'titulo': 'TITULO GENERAL',
        'encabezado': 'ENCABEZADO GENERAL',
        'cuerpo': 'CUERPO GENERAL',
        'plantillas_procesos': {
            'egreso_activo': {
                'personalizado': True,
                'titulo': 'PUNTO DE CUENTA - EGRESO',
                'encabezado': 'Notificación de egreso:',
                'cuerpo': 'El trabajador {nombre} ({cedula}) egresa por {motivo}.',
            }
        }
    }
    t, e, c = resolver_plantilla_proceso(cfg, 'egreso_activo')
    assert t == 'PUNTO DE CUENTA - EGRESO'
    assert e == 'Notificación de egreso:'
    assert c == 'El trabajador {nombre} ({cedula}) egresa por {motivo}.'


def test_generar_vista_previa_pdf_con_plantilla_proceso():
    cfg = {
        'titulo': 'TITULO GENERAL',
        'encabezado': 'ENCABEZADO GENERAL',
        'cuerpo': 'CUERPO GENERAL {nombre}',
        'mostrar_nivel': True,
        'firmas': [{'cargo': 'Gerente General', 'nombre': 'Ana Ruiz'}],
        'plantillas_procesos': {
            'cambio_oficina': {
                'personalizado': True,
                'titulo': 'TRASLADO DE OFICINA',
                'encabezado': 'Encabezado de traslado',
                'cuerpo': '{nombre} va desde {origen} hacia {destino}',
            }
        }
    }
    with patch('apps.puntocuenta.infrastructure.pdf_punto_cuenta.construir_config_pdf') as mock_cfg:
        mock_cfg.return_value = {
            'cintillo': {'visible': False, 'alto': 20, 'imagen_bytes': None},
            'logo_izquierdo': {'visible': False, 'ancho': 20, 'alto': 20, 'imagen_bytes': None},
            'logo_derecho': {'visible': False, 'ancho': 20, 'alto': 20, 'imagen_bytes': None},
            'nombre_institucion': 'CONATEL',
            'subtitulo': 'Gestión del Talento Humano',
            'mostrar_fecha': True,
            'mostrar_paginacion': True,
        }
        pdf_bytes = generar_vista_previa_pdf(cfg, proceso='cambio_oficina')
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b'%PDF-')
