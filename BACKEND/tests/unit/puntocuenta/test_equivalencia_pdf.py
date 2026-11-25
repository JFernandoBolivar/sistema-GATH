"""Equivalencia textual entre el PDF anterior y el diseñador de documentos.

`_texto_legado.json` es el texto extraído con ``pdftotext -layout`` del PDF
anterior para el DTO y la configuración de prueba. No queda un generador viejo
en paralelo: la prueba solo conserva su resultado textual normalizado.
"""
import importlib
import json
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from apps.documentos.infrastructure.pdf.motor_formulario import renderizar_formulario
from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from apps.puntocuenta.application.use_cases.generar_punto_cuenta import (
    datos_para_documento,
)
from tests.unit.documentos._ayudas import texto_de

MIGRACION = importlib.import_module('apps.puntocuenta.migrations.0007_plantillas_punto_cuenta_datos')
CONFIG_PDF = {
    'tipo_cintillo': 'INSTITUCIONAL',
    'logo_principal_bytes': None,
    'logo_secundario_bytes': None,
    'nombre_institucion': 'CONATEL',
    'subtitulo': 'Gestión del Talento Humano',
    'mostrar_fecha': True,
    'mostrar_paginacion': True,
}


def _normalizar(texto: str) -> str:
    """Quita solo cromos de paginación/fecha y líneas de firma dibujadas como texto."""
    lineas = []
    for linea in texto.splitlines():
        contenido = ' '.join(linea.split())
        if not contenido or contenido.startswith(('Generado:', 'Página ')):
            continue
        if not contenido.strip('_ '):
            continue
        lineas.append(contenido)
    return ' '.join(lineas)


def _dto() -> PuntoCuentaDTO:
    return PuntoCuentaDTO(
        id='00000000-0000-4000-8000-000000000001',
        cargo_id=5,
        empleado_cedula='V-18456789',
        empleado_nombre='ANA MARÍA PÉREZ',
        dependencia_origen_id=1,
        dependencia_origen_nombre='NIVEL CENTRAL',
        dependencia_destino_id=2,
        dependencia_destino_nombre='NIVEL ADMINISTRATIVO',
        motivo_id=3,
        motivo_nombre='TRASLADO POR NECESIDAD',
        usuario_id=1,
        fecha='2026-11-24T10:00:00+00:00',
        documento_pdf_clave=None,
        documento_generado=False,
        oficina_origen='GERENCIA DE OPERACIONES',
        oficina_destino='GERENCIA DE PLANIFICACIÓN',
        division_origen='DIVISIÓN DE REDES',
        division_destino='DIVISIÓN DE SERVICIOS',
        numero='0001-2026',
        anio=2026,
        secuencia=1,
        cargo_codigo='ADM-042',
        cargo_nombre='ESPECIALISTA EN TELECOMUNICACIONES',
        cargo_destino='COORDINADOR DE PROYECTOS',
        nivel='PROFESIONAL III',
        tipo_personal='PERSONAL FIJO',
        fecha_efectiva='01/12/2026',
        fecha_ingreso='15/03/2015',
        anios_servicio='11',
    )


def _configuracion() -> dict:
    fila = SimpleNamespace(
        titulo='PUNTO DE CUENTA FORMAL',
        encabezado='Encabezado configurado {nombre}',
        cuerpo='Cuerpo configurado de {nombre}.',
        presentado_a='Lic. María Rodríguez',
        cargo_presentado_a='Directora General',
        presentado_por='Lic. Juan Pérez',
        cargo_presentado_por='Jefe de Recursos Humanos',
        unidad='Dirección de Recursos Humanos',
        asunto='Asunto formal de {nombre}',
        exposicion='Exposición de {nombre}.\n\nSegundo párrafo desde {origen} hacia {destino}.',
        propuesta='Propuesta para {nombre} en {cargo_destino}.',
        base_legal='Base legal aplicable.',
        observaciones_texto='Observación para {nombre}.',
        incluir_presentado_a=True,
        incluir_presentado_por=True,
        incluir_asunto=True,
        incluir_exposicion=True,
        incluir_propuesta=True,
        incluir_base_legal=True,
        incluir_decision=True,
        incluir_observaciones=True,
        incluir_tabla_resumen=True,
        incluir_firmas=True,
        firmas=[
            {'cargo': 'Director(a) General', 'nombre': 'May. Jorge Márquez'},
            {'cargo': 'Gerente de RRHH', 'nombre': 'Lic. María Contreras'},
        ],
        mostrar_nivel=False,
        plantillas_procesos={
            'general': {
                'presentado_a': 'Lic. María Rodríguez',
                'cargo_presentado_a': 'Directora General',
                'presentado_por': 'Lic. Juan Pérez',
                'cargo_presentado_por': 'Jefe de Recursos Humanos',
                'unidad': 'Dirección de Recursos Humanos',
                'asunto': 'Asunto formal de {nombre}',
                'exposicion': 'Exposición de {nombre}.\n\nSegundo párrafo desde {origen} hacia {destino}.',
                'propuesta': 'Propuesta para {nombre} en {cargo_destino}.',
                'base_legal': 'Base legal aplicable.',
                'observaciones_texto': 'Observación para {nombre}.',
                'incluir_tabla_resumen': True,
            },
            'cambio_oficina': {
                'personalizado': True,
                'asunto': 'Asunto propio de {nombre}',
                'exposicion': 'Exposición propia de {nombre}.',
                'propuesta': 'Propuesta propia.',
                'base_legal': 'Base propia.',
                'observaciones_texto': 'Observación propia.',
                'incluir_tabla_resumen': True,
            },
        },
    )
    return MIGRACION.configuracion_efectiva(fila)


@pytest.mark.parametrize('escenario', ['cambio_oficina', 'ingreso_postulacion', 'ingreso_sin_constancia'])
def test_texto_normalizado_del_pdf_nuevo_es_igual_al_anterior(escenario):
    proceso = 'ingreso_postulacion' if escenario.startswith('ingreso') else escenario
    dto = replace(
        _dto(),
        referencia_constancia='PART-2026-045',
        emitido_por='María Gómez',
    )
    if escenario == 'ingreso_sin_constancia':
        dto = replace(dto, referencia_constancia=None, emitido_por=None)
    config = _configuracion()
    secciones = MIGRACION.resolver_secciones(config, proceso)
    definicion, propios = MIGRACION.construir_definicion(secciones, config['firmas'], config['mostrar_nivel'])
    datos, valores = datos_para_documento(dto)
    datos.update({f'propio.{clave}': valor for clave, valor in valores.items()})
    pdf = renderizar_formulario(
        {'definicion': definicion, 'campos_propios': propios, 'modo': 'formulario'},
        datos,
        CONFIG_PDF,
    )
    esperado = json.loads(Path(__file__).with_name('_texto_legado.json').read_text(encoding='utf-8'))[escenario]
    assert _normalizar(texto_de(pdf)) == esperado


def test_las_firmas_especificas_del_proceso_tienen_prioridad():
    config = _configuracion()
    config['plantillas_procesos']['cambio_division'] = {
        'firmas': [{'cargo': 'Coordinador(a) de Nómina', 'nombre': 'ANA RUIZ'}],
    }
    secciones = MIGRACION.resolver_secciones(config, 'cambio_division')
    definicion, _ = MIGRACION.construir_definicion(secciones, secciones['firmas'], config['mostrar_nivel'])
    firmas = [b for b in definicion['bloques'] if b['tipo'] == 'firmas']
    assert firmas == [{
        'id': firmas[0]['id'],
        'tipo': 'firmas',
        'firmantes': [{'etiqueta': 'Coordinador(a) de Nómina', 'detalle': 'ANA RUIZ'}],
    }]


def test_las_firmas_largas_no_pierden_texto_por_el_recorte_del_bloque_formal():
    config = _configuracion()
    cargo = 'Director(a) General de Gestión Humana y Administración ' * 3
    nombre = 'MARÍA JOSEFINA CONTRERAS RODRÍGUEZ ' * 3
    secciones = MIGRACION.resolver_secciones(config, 'cambio_oficina')
    definicion, _ = MIGRACION.construir_definicion(secciones, [{'cargo': cargo, 'nombre': nombre}], True)
    textos = [b['texto'] for b in definicion['bloques'] if b['tipo'] == 'parrafo']
    assert cargo.strip() in textos and nombre.strip() in textos
    assert not [b for b in definicion['bloques'] if b['tipo'] == 'firmas']
