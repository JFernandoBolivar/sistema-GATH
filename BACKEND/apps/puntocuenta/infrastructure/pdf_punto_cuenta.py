"""
Generador del documento PDF de un Punto de Cuenta, reutilizando el motor
genérico de `core/infrastructure/pdf/` con cintillo institucional y Arial.
Soporta sustitución de variables dinámicas, firmas configurables y vista previa.
"""
from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from apps.puntocuenta.domain.services.variables_plantilla import DICCIONARIO_VARIABLES
from core.infrastructure.pdf.pdf_components import create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG, get_paragraph_styles


def _formatear_lugar(oficina: str | None, nivel: str | None, mostrar_nivel: bool) -> str:
    if not oficina and not nivel:
        return 'N/A'
    if not mostrar_nivel:
        return oficina or nivel or 'N/A'
    if oficina and nivel:
        return f"{oficina} ({nivel})"
    return oficina or nivel or 'N/A'


def resolver_plantilla_proceso(configuracion: dict, proceso: str | None = None) -> tuple[str, str, str]:
    """
    Resuelve (titulo, encabezado, cuerpo) según el tipo de proceso administrativo.
    Si el proceso está habilitado y tiene plantilla personalizada, la usa;
    de lo contrario, hace fallback automático a la plantilla general.
    """
    titulo_gen = configuracion.get('titulo') or 'PUNTO DE CUENTA'
    encabezado_gen = configuracion.get('encabezado') or ''
    cuerpo_gen = configuracion.get('cuerpo') or ''

    if not proceso:
        return titulo_gen, encabezado_gen, cuerpo_gen

    plantillas = configuracion.get('plantillas_procesos') or {}
    cfg_proc = plantillas.get(proceso)
    if isinstance(cfg_proc, dict) and cfg_proc.get('personalizado'):
        titulo = (cfg_proc.get('titulo') or '').strip() or titulo_gen
        encabezado = cfg_proc.get('encabezado') if cfg_proc.get('encabezado') is not None else encabezado_gen
        cuerpo = cfg_proc.get('cuerpo') if cfg_proc.get('cuerpo') is not None else cuerpo_gen
        return titulo, encabezado, cuerpo

    return titulo_gen, encabezado_gen, cuerpo_gen


def _reemplazar_variables(texto: str, variables: dict[str, str]) -> str:
    res = texto or ''
    for clave, val in variables.items():
        res = res.replace(f"{{{clave}}}", val or 'N/A')
    return res


def _construir_bloque_firmas(firmas: list[dict], styles, width: float) -> Table | None:
    if not firmas:
        return None

    filas = []
    # Línea de firma y cargos
    linea = "____________________________________"
    fila_lineas = []
    fila_cargos = []
    fila_nombres = []

    for f in firmas:
        cargo = str(f.get('cargo') or '').strip()
        nombre = str(f.get('nombre') or '').strip()
        fila_lineas.append(Paragraph(f"<para align='center'><b>{linea}</b></para>", styles['Normal']))
        fila_cargos.append(Paragraph(f"<para align='center'><b>{escape(cargo)}</b></para>", styles['Normal']))
        fila_nombres.append(Paragraph(f"<para align='center'>{escape(nombre)}</para>", styles['Normal']))

    filas.append(fila_lineas)
    filas.append(fila_cargos)
    filas.append(fila_nombres)

    col_width = width / len(firmas)
    t = Table(filas, colWidths=[col_width] * len(firmas))
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    return t


def construir_pdf_punto_cuenta(dto: PuntoCuentaDTO, configuracion: dict | None = None, proceso: str | None = None) -> bytes:
    if configuracion is None:
        from apps.puntocuenta.application.use_cases.configurar_punto_cuenta import obtener_configuracion_activa
        configuracion = obtener_configuracion_activa()

    generado_en = datetime.now()
    page_config = PAGE_CONFIG['portrait']
    from reportlab.lib.styles import getSampleStyleSheet
    sample_sheet = getSampleStyleSheet()
    styles = get_paragraph_styles()
    if 'Normal' not in styles:
        styles['Normal'] = sample_sheet['Normal']
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_config['pagesize'],
        leftMargin=page_config['leftMargin'],
        rightMargin=page_config['rightMargin'],
        topMargin=page_config['topMargin'],
        bottomMargin=page_config['bottomMargin'],
        title=configuracion.get('titulo') or 'Punto de Cuenta',
        author='GATH - CONATEL',
        subject=f"Punto de cuenta generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
    )

    mostrar_nivel = configuracion.get('mostrar_nivel', True)
    origen_txt = _formatear_lugar(dto.oficina_origen, dto.dependencia_origen_nombre, mostrar_nivel)
    destino_txt = _formatear_lugar(dto.oficina_destino, dto.dependencia_destino_nombre, mostrar_nivel)
    numero_txt = dto.numero or str(dto.id)

    cargo_txt = dto.cargo_nombre or dto.cargo_codigo or str(dto.cargo_id)

    variables = {
        'nombre': dto.empleado_nombre or 'N/A',
        'cedula': dto.empleado_cedula or 'N/A',
        'cargo': cargo_txt,
        'origen': origen_txt,
        'destino': destino_txt,
        'fecha': dto.fecha[:10] if dto.fecha else generado_en.strftime('%d/%m/%Y'),
        'motivo': dto.motivo_nombre or 'N/A',
        'numero': numero_txt,
    }

    titulo_doc, encabezado_raw, cuerpo_raw = resolver_plantilla_proceso(configuracion, proceso)

    encabezado_procesado = _reemplazar_variables(encabezado_raw, variables)
    cuerpo_procesado = _reemplazar_variables(cuerpo_raw, variables)

    story = [
        Spacer(1, 10),
    ]

    # Número y Fecha a la derecha
    meta_info = f"<para align='right'><b>Punto de Cuenta N.º:</b> {escape(numero_txt)}<br/><b>Fecha:</b> {variables['fecha']}</para>"
    story.append(Paragraph(meta_info, styles['Normal']))
    story.append(Spacer(1, 15))

    # Título central
    story.append(Paragraph(f"<para align='center'><b><font size='14'>{escape(titulo_doc)}</font></b></para>", styles['Title']))
    story.append(Spacer(1, 15))

    if encabezado_procesado.strip():
        story.append(Paragraph(escape(encabezado_procesado), styles['Normal']))
        story.append(Spacer(1, 12))

    # Tabla resumen de datos estructurados
    tabla_datos = [
        [Paragraph("<b>Servidor(a) Público(a):</b>", styles['Normal']), Paragraph(f"{escape(variables['nombre'])} (C.I. {escape(variables['cedula'])})", styles['Normal'])],
        [Paragraph("<b>Cargo / Puesto:</b>", styles['Normal']), Paragraph(escape(cargo_txt), styles['Normal'])],
        [Paragraph("<b>Ubicación de Origen:</b>", styles['Normal']), Paragraph(escape(origen_txt), styles['Normal'])],
        [Paragraph("<b>Ubicación de Destino:</b>", styles['Normal']), Paragraph(escape(destino_txt), styles['Normal'])],
        [Paragraph("<b>Motivo del Movimiento:</b>", styles['Normal']), Paragraph(escape(variables['motivo']), styles['Normal'])],
    ]
    t_resumen = Table(tabla_datos, colWidths=[doc.width * 0.35, doc.width * 0.65])
    t_resumen.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ]))
    story.append(t_resumen)
    story.append(Spacer(1, 16))

    if cuerpo_procesado.strip():
        story.append(Paragraph(escape(cuerpo_procesado), styles['Normal']))
        story.append(Spacer(1, 30))

    # Firmas
    firmas = configuracion.get('firmas') or []
    bloque_firmas = _construir_bloque_firmas(firmas, styles, doc.width)
    if bloque_firmas:
        story.append(Spacer(1, 20))
        story.append(bloque_firmas)

    config_pdf = construir_config_pdf()

    def _en_pagina(canvas, doc_):
        canvas.saveState()
        for el in create_header(titulo_doc, width=doc_.width, config=config_pdf):
            el.wrap(doc_.width, doc_.topMargin)
            el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 10)
        canvas.restoreState()
        draw_footer(canvas, doc_, doc_.page, 1, f"Generado: {generado_en.strftime('%d/%m/%Y %H:%M')}", config=config_pdf)

    doc.build(story, onFirstPage=_en_pagina, onLaterPages=_en_pagina)
    buffer.seek(0)
    return buffer.getvalue()


def generar_vista_previa_pdf(configuracion: dict, proceso: str | None = None) -> bytes:
    """Genera un PDF de muestra con datos ficticios para previsualización."""
    dto_ejemplo = PuntoCuentaDTO(
        id='00000000-0000-0000-0000-000000000000',
        cargo_id=101,
        cargo_codigo='ADM-042',
        cargo_nombre='ESPECIALISTA EN TELECOMUNICACIONES',
        empleado_cedula='V-18456789',
        empleado_nombre='JUAN ALBERTO PÉREZ RODRÍGUEZ',
        dependencia_origen_id=1,
        dependencia_origen_nombre='Nivel Central',
        dependencia_destino_id=1,
        dependencia_destino_nombre='Nivel Central',
        oficina_origen_id=2,
        oficina_origen='Gerencia de Operaciones',
        oficina_destino_id=5,
        oficina_destino='Gerencia de Planificación Estratégica',
        division_origen_id=None,
        division_origen=None,
        division_destino_id=None,
        division_destino=None,
        motivo_id=3,
        motivo_nombre='TRASLADO POR NECESIDAD DE SERVICIO',
        usuario_id=1,
        fecha=datetime.now().isoformat(),
        documento_pdf_clave=None,
        documento_generado=False,
        numero='0001-2026',
        anio=2026,
        secuencia=1,
    )
    return construir_pdf_punto_cuenta(dto_ejemplo, configuracion, proceso=proceso)
