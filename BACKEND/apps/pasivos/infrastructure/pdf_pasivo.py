"""
Generador del PDF de expediente de un trabajador pasivo, migrado desde
`NextJS/src/modules/pasivos/ui/pdf/reporte-pasivo-pdf.tsx` (@react-pdf/
renderer, cliente) a backend con ReportLab -- mismo motor y cintillo
configurable que ya usan `apps.reportes`/`apps.puntocuenta`
(`core/infrastructure/pdf/pdf_components.py` +
`apps.configuracion.infrastructure.pdf_config.construir_config_pdf()`).

`PasivoDTO` ya trae todos los nombres de catálogo resueltos (mismo mapper
compartido con `apps.personal`, ver `construir_expediente()`), así que este
módulo solo formatea, no resuelve ningún ID.
"""
from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.pasivos.application.dtos.pasivos_dtos import PasivoDTO
from core.infrastructure.pdf.pdf_components import create_data_table, create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG, get_paragraph_styles


def _val(v) -> str:
    return str(v) if v not in (None, "") else "N/A"


def _fecha(v) -> str:
    if not v:
        return "N/A"
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except ValueError:
        return str(v)


def _info_row(label: str, valor: str, styles) -> Paragraph:
    return Paragraph(f"<b>{escape(label)}:</b> {escape(valor)}", styles['TableCell'])


def _seccion(titulo: str, styles) -> Paragraph:
    return Paragraph(escape(titulo), styles['TableHeader'])


def _lista_nombres(nombres: list[str] | None) -> str:
    return ", ".join(n for n in (nombres or []) if n) or "Ninguna"


def construir_pdf_expediente_pasivo(dto: PasivoDTO) -> bytes:
    generado_en = datetime.now()
    page_config = PAGE_CONFIG['portrait']
    styles = get_paragraph_styles()
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_config['pagesize'],
        leftMargin=page_config['leftMargin'],
        rightMargin=page_config['rightMargin'],
        topMargin=page_config['topMargin'],
        bottomMargin=page_config['bottomMargin'],
        title=f"Expediente de pasivo {dto.cedula}",
        author='GATH - CONATEL',
        subject=f"Expediente generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
    )

    vivienda = dto.datos_vivienda or {}
    salud = dto.perfil_salud or {}
    fisico = dto.perfil_fisico or {}

    story = [
        Spacer(1, 2),
        _seccion('DATOS PERSONALES', styles),
        _info_row('Cédula de Identidad', dto.cedula, styles),
        _info_row('Nombres y Apellidos', dto.nombre_completo, styles),
        _info_row('Tipo', dto.tipo_pasivo, styles),
        _info_row('Fecha de egreso', _fecha(dto.fecha_egreso), styles),
        _info_row('Resolución', _val(dto.resolucion), styles),
        _info_row('Dirección de habitación', _val(vivienda.get('direccion_exacta')), styles),
        Spacer(1, 6),
        _seccion('FORMACIÓN ACADÉMICA', styles),
    ]

    if dto.formacion_academica:
        columnas = ['#', 'Nivel académico', 'Carrera', 'Mención', 'Institución']
        filas = [
            {
                '#': idx + 1,
                'Nivel académico': _val(fa.get('nivel_academico_nombre')),
                'Carrera': _val(fa.get('carrera_nombre')),
                'Mención': _val(fa.get('mencion_nombre')),
                'Institución': _val(fa.get('institucion_nombre')),
            }
            for idx, fa in enumerate(dto.formacion_academica)
        ]
        story.append(create_data_table(columnas, filas))
    else:
        story.append(Paragraph('Sin formación académica registrada.', styles['TableCell']))

    story.append(Spacer(1, 6))
    story.append(_seccion('HISTORIAL DE CARGOS (AL MOMENTO DEL EGRESO)', styles))
    if dto.cargos_historial:
        columnas = ['#', 'Código', 'Cargo específico', 'Nómina', 'Dependencia']
        filas = []
        for idx, c in enumerate(dto.cargos_historial):
            dependencia = (
                c.get('coordinacion_nombre')
                or c.get('direccion_linea_nombre')
                or c.get('direccion_general_nombre')
                or c.get('dependencia_nombre')
            )
            filas.append({
                '#': idx + 1,
                'Código': _val(c.get('codigo')),
                'Cargo específico': _val(c.get('denominacioncargoespecifico_nombre')),
                'Nómina': _val(c.get('tipo_nomina_nombre')),
                'Dependencia': _val(dependencia),
            })
        story.append(create_data_table(columnas, filas))
    else:
        story.append(Paragraph('Sin cargos registrados.', styles['TableCell']))

    story.append(Spacer(1, 6))
    story.append(_seccion('ANTECEDENTES LABORALES', styles))
    if dto.antecedentes:
        columnas = ['#', 'Fecha ingreso', 'Fecha egreso', 'Organismo']
        filas = [
            {
                '#': idx + 1,
                'Fecha ingreso': _fecha(a.get('fecha_ingreso')),
                'Fecha egreso': _fecha(a.get('fecha_egreso')) if a.get('fecha_egreso') else 'Presente',
                'Organismo': _val(a.get('organismo_nombre')),
            }
            for idx, a in enumerate(dto.antecedentes)
        ]
        story.append(create_data_table(columnas, filas))
    else:
        story.append(Paragraph('Sin antecedentes registrados.', styles['TableCell']))

    story.append(Spacer(1, 6))
    story.append(_seccion('SALUD Y BIENESTAR', styles))
    story.append(_info_row('Grupo sanguíneo', _val(salud.get('grupo_sanguineo_nombre')), styles))
    story.append(_info_row('Alergias', _lista_nombres(salud.get('alergias_nombres')), styles))
    story.append(_info_row('Patologías crónicas', _lista_nombres(salud.get('patologias_cronicas_nombres')), styles))
    story.append(_info_row('Discapacidades', _lista_nombres(salud.get('discapacidades_nombres')), styles))
    story.append(_info_row('Talla de camisa', _val(fisico.get('talla_camisa_nombre')), styles))
    story.append(_info_row('Talla de pantalón', _val(fisico.get('talla_pantalon_nombre')), styles))
    story.append(_info_row('Talla de zapatos', _val(fisico.get('talla_zapatos_nombre')), styles))

    config_pdf = construir_config_pdf()

    def _en_pagina(canvas, doc_):
        canvas.saveState()
        for el in create_header('Información del jubilado/pasivo', width=doc_.width, config=config_pdf):
            el.wrap(doc_.width, doc_.topMargin)
            el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 10)
        canvas.restoreState()
        draw_footer(canvas, doc_, doc_.page, 0, f"Generado: {generado_en.strftime('%d/%m/%Y %H:%M')}", config=config_pdf)

    doc.build(story, onFirstPage=_en_pagina, onLaterPages=_en_pagina)
    buffer.seek(0)
    return buffer.getvalue()
