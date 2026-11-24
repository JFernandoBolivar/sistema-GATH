"""Proceso `ingreso_postulacion` del Punto de Cuenta (E-5): variables, plantilla propia y PDF (el cintillo lee la BD)."""
from datetime import datetime

import pytest

from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from apps.puntocuenta.domain.services.variables_plantilla import VARIABLES_PERMITIDAS, validar_variables_texto
from apps.puntocuenta.domain.value_objects.plantilla_punto_cuenta import (
    PROCESO_INGRESO_POSTULACION,
    PROCESOS_POR_DEFECTO,
)
from apps.puntocuenta.infrastructure.pdf_punto_cuenta import (
    DEFECTOS_POR_PROCESO,
    construir_pdf_punto_cuenta,
    resolver_secciones_plantilla,
)

CONFIG = {
    'titulo': 'PUNTO DE CUENTA', 'encabezado': 'Para su conocimiento, se notifica el siguiente movimiento de personal:',
    'cuerpo': 'Movimiento del funcionario {nombre}.', 'firmas': [{'cargo': 'Director(a) General', 'nombre': ''}],
    'mostrar_nivel': True, 'plantillas_procesos': {}, 'version': 1,
}


def dto(**extra):
    base = dict(
        id='00000000-0000-4000-8000-000000000001', cargo_id=5, empleado_cedula='12345678', empleado_nombre='ANA MARÍA PÉREZ',
        dependencia_origen_id=None, dependencia_origen_nombre=None, dependencia_destino_id=1,
        dependencia_destino_nombre='NIVEL CENTRAL', motivo_id=None, motivo_nombre=None, usuario_id=1,
        fecha=datetime(2026, 11, 24).isoformat(), documento_pdf_clave=None, documento_generado=False,
        oficina_destino_id=2, oficina_destino='GESTION HUMANA', numero='0001-2026', cargo_codigo='A-001',
        cargo_nombre='ANALISTA', cargo_destino='ANALISTA', referencia_constancia='PART-2026-045', emitido_por='María Gómez',
    )
    return PuntoCuentaDTO(**{**base, **extra})


def test_el_proceso_ingreso_esta_en_los_procesos_por_defecto_y_sus_variables_son_validas():
    assert PROCESOS_POR_DEFECTO[PROCESO_INGRESO_POSTULACION] is True
    assert {'referencia_constancia', 'emitido_por'} <= VARIABLES_PERMITIDAS
    for texto in DEFECTOS_POR_PROCESO[PROCESO_INGRESO_POSTULACION].values():
        assert validar_variables_texto(texto) == [], texto


def test_la_plantilla_del_ingreso_sustituye_a_la_general_de_movimientos_pero_no_a_una_personalizada():
    s = resolver_secciones_plantilla(CONFIG, PROCESO_INGRESO_POSTULACION)
    assert 'ingreso' in s['asunto'] and 'ingreso' in s['exposicion'] and '{referencia_constancia}' in s['exposicion']
    assert 'movimiento de personal' not in s['asunto']
    # sin proceso, o con otro, rige la general como siempre
    assert 'movimiento' in resolver_secciones_plantilla(CONFIG)['encabezado'].lower()
    assert 'ingreso' not in resolver_secciones_plantilla(CONFIG, 'cambio_oficina')['asunto']
    propia = {**CONFIG, 'plantillas_procesos': {PROCESO_INGRESO_POSTULACION: {'personalizado': True, 'asunto': 'Asunto propio {nombre}'}}}
    s = resolver_secciones_plantilla(propia, PROCESO_INGRESO_POSTULACION)
    assert s['asunto'] == 'Asunto propio {nombre}' and 'ingreso' in s['exposicion']  # el resto sigue con el defecto del proceso


@pytest.mark.django_db
def test_el_pdf_del_ingreso_se_genera_con_los_datos_del_postulante():
    pdf = construir_pdf_punto_cuenta(dto(), CONFIG, proceso=PROCESO_INGRESO_POSTULACION)
    assert pdf.startswith(b'%PDF') and len(pdf) > 1500
    # sin referencia ni emisor (p. ej. regenerado bajo demanda) no revienta: usa N/A
    assert construir_pdf_punto_cuenta(dto(referencia_constancia=None, emitido_por=None), CONFIG, proceso=PROCESO_INGRESO_POSTULACION).startswith(b'%PDF')
