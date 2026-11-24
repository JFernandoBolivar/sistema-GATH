"""Motores de PDF de los dos modos: PDF válido, páginas correctas y valores presentes (F-1, F-2)."""
import pytest

from apps.documentos.domain.services.variables_documento import datos_ejemplo
from apps.documentos.domain.value_objects.esquema_documento import validar_definicion
from apps.documentos.infrastructure.pdf.motor import InspectorPdfDocumentos, MotorPdfDocumentos
from core.domain.exceptions import ValidationError
from tests.unit.documentos._ayudas import (
    CAMPOS_PROPIOS,
    definicion_formulario,
    definicion_overlay,
    imagenes_de,
    paginas_de,
    pdf_fondo,
    texto_de,
)


def _formulario(datos=None, **cambios):
    definicion, propios = validar_definicion('formulario', definicion_formulario(), CAMPOS_PROPIOS)
    contexto = {'modo': 'formulario', 'definicion': definicion, 'campos_propios': propios, 'config_pdf': None, **cambios}
    return MotorPdfDocumentos().renderizar(contexto, datos or datos_ejemplo(propios))


def test_formulario_genera_pdf_con_las_paginas_y_el_texto_de_las_variables():
    pdf = _formulario()
    assert pdf.startswith(b'%PDF-')
    assert paginas_de(pdf) == 2  # el salto de página manda las firmas a la segunda
    texto = texto_de(pdf)
    assert 'DOCUMENTO DE PRUEBA' in texto
    assert 'PÉREZ RODRÍGUEZ JUAN ALBERTO' in texto and 'V-18456789' in texto  # fila de campos
    assert 'Ejemplo: Sueldo al que aspira' in texto  # campo propio en el párrafo
    assert 'MARÍA GÓMEZ DE PÉREZ' in texto and 'CÓNYUGE' in texto  # tabla de familiares
    assert 'Masculino' in texto and 'Femenino' in texto  # casillas
    assert 'FIRMA DEL TRABAJADOR' in texto and 'RECIBIDO POR' in texto


def test_formulario_marca_solo_la_opcion_que_corresponde():
    marcado = texto_de(_formulario(datos={**datos_ejemplo(), 'sexo': 'FEMENINO'}))
    # la «X» de la casilla sale junto a la etiqueta marcada
    assert 'Masculino' in marcado
    lineas = [l for l in marcado.splitlines() if 'Femenino' in l]
    assert lineas and 'X' in lineas[0]


def test_formulario_en_oficio_horizontal_y_sin_encabezado():
    definicion, propios = validar_definicion('formulario', {**definicion_formulario(),
        'pagina': {'tamano': 'oficio', 'orientacion': 'horizontal'},
        'encabezado': {'tipo': 'ninguno', 'titulo': 'Solo título'}}, CAMPOS_PROPIOS)
    pdf = MotorPdfDocumentos().renderizar({'modo': 'formulario', 'definicion': definicion, 'campos_propios': propios,
                                           'config_pdf': None}, datos_ejemplo(propios))
    assert 'SOLO TÍTULO' in texto_de(pdf)
    assert b'/MediaBox [ 0 0 936 612 ]' in pdf or b'936' in pdf


def test_texto_con_caracteres_de_marcado_no_rompe_el_pdf():
    datos = {**datos_ejemplo(), 'nombre_completo': 'A <b>&</b> "B" <script>'}
    assert '<script>' in texto_de(_formulario(datos=datos))


def test_overlay_conserva_el_fondo_y_anade_la_capa():
    fondo = pdf_fondo(paginas=2)
    inspector = InspectorPdfDocumentos()
    paginas = inspector.inspeccionar(fondo)
    assert [(p['numero'], p['ancho_pt'], p['alto_pt']) for p in paginas] == [(1, 540.0, 720.0), (2, 540.0, 720.0)]

    definicion, _ = validar_definicion('pdf_overlay', definicion_overlay((1, 2)), [], paginas)
    contexto = {'modo': 'pdf_overlay', 'definicion': definicion, 'campos_propios': [], 'fondo_pdf': fondo, 'fondo_paginas': paginas}
    pdf = MotorPdfDocumentos().renderizar(contexto, datos_ejemplo())

    assert paginas_de(pdf) == 2
    assert imagenes_de(pdf) == 2  # el fondo de cada página va incrustado
    texto = texto_de(pdf)
    assert 'PÉREZ RODRÍGUEZ JUAN ALBERTO' in texto  # capa de texto nueva
    assert 'MARÍA GÓMEZ DE PÉREZ' in texto and 'SOFÍA PÉREZ GÓMEZ' in texto  # tabla con interlineado
    assert 'X' in texto  # casilla marcada (sexo MASCULINO)


def test_overlay_usa_solo_las_paginas_elegidas_y_en_ese_orden():
    fondo = pdf_fondo(paginas=3)
    paginas = InspectorPdfDocumentos().inspeccionar(fondo)
    definicion, _ = validar_definicion('pdf_overlay', definicion_overlay((3,)), [], paginas)
    pdf = MotorPdfDocumentos().renderizar(
        {'modo': 'pdf_overlay', 'definicion': definicion, 'campos_propios': [], 'fondo_pdf': fondo, 'fondo_paginas': paginas},
        datos_ejemplo())
    assert paginas_de(pdf) == 1


def test_overlay_casilla_sin_coincidencia_no_marca():
    fondo = pdf_fondo(paginas=1)
    paginas = InspectorPdfDocumentos().inspeccionar(fondo)
    definicion, _ = validar_definicion('pdf_overlay', definicion_overlay(), [], paginas)
    pdf = MotorPdfDocumentos().renderizar(
        {'modo': 'pdf_overlay', 'definicion': definicion, 'campos_propios': [], 'fondo_pdf': fondo, 'fondo_paginas': paginas},
        {**datos_ejemplo(), 'sexo': 'FEMENINO'})
    assert 'X' not in texto_de(pdf).replace('XXX', '')


def test_inspector_rechaza_un_pdf_invalido():
    with pytest.raises(ValidationError):
        InspectorPdfDocumentos().inspeccionar(b'%PDF-1.4 esto no es un pdf')


def test_motor_de_fondo_devuelve_png():
    png = MotorPdfDocumentos().renderizar_pagina_fondo(pdf_fondo(1), 1)
    assert png.startswith(b'\x89PNG')
