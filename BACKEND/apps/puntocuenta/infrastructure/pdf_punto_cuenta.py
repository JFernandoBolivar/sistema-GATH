"""
Generador del documento PDF de un Punto de Cuenta (RN-006-01, O31),
conforme al estándar formal de la Administración Pública venezolana.
Reutiliza el motor genérico de `core/infrastructure/pdf/` con cintillo institucional y Arial.
Formato: Arial 12pt, interlineado 1.5 (leading 18pt), texto justificado,
márgenes formales (20mm), título único en cintillo sin duplicación,
secciones estructuradas y configurables, y casillas de decisión de la autoridad.
"""
from datetime import datetime
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from apps.puntocuenta.domain.services.variables_plantilla import (
    DICCIONARIO_VARIABLES,
    formatear_fecha_larga,
)
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from core.infrastructure.pdf.paleta import (
    AZUL_CONATEL,
    GRIS_BORDE,
    GRIS_FONDO,
    GRIS_MUTED,
    GRIS_TEXTO,
    NEGRO,
)
from core.infrastructure.pdf.pdf_components import create_header, draw_footer
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG


PRESENTADO_A_DEFECTO = "Director(a) General de la Comisión Nacional de Telecomunicaciones"
CARGO_PRESENTADO_A_DEFECTO = "Director(a) General"
PRESENTADO_POR_DEFECTO = "Director(a) General de Gestión Humana"
CARGO_PRESENTADO_POR_DEFECTO = "Director(a) General de Gestión Humana"
UNIDAD_DEFECTO = "Dirección General de Gestión Humana"
ASUNTO_DEFECTO = "Notificación y solicitud de aprobación para movimiento de personal de {nombre} (C.I. {cedula})."
EXPOSICION_DEFECTO = (
    "Por medio del presente punto de cuenta, se somete a su digna consideración el movimiento administrativo "
    "del funcionario {nombre}, titular de la cédula de identidad N.º {cedula}, quien actualmente labora como {cargo}.\n\n"
    "Dicho movimiento corresponde a {motivo}, trasladándose desde {origen} hacia {destino}, con fecha {fecha}."
)
PROPUESTA_DEFECTO = (
    "En atención a lo expuesto, se propone muy respetuosamente a la Máxima Autoridad autorizar el traslado y "
    "asignación del funcionario {nombre} a la unidad {destino} en el cargo de {cargo_destino}."
)
BASE_LEGAL_DEFECTO = (
    "De conformidad con lo dispuesto en el Estatuto de la Función Pública, el Reglamento Interno "
    "de la Comisión Nacional de Telecomunicaciones y demás normativa aplicable."
)


def _formatear_lugar(oficina: str | None, nivel: str | None, mostrar_nivel: bool) -> str:
    if not oficina and not nivel:
        return 'N/A'
    if not mostrar_nivel:
        return oficina or nivel or 'N/A'
    if oficina and nivel:
        return f"{oficina} ({nivel})"
    return oficina or nivel or 'N/A'


def resolver_secciones_plantilla(configuracion: dict, proceso: str | None = None) -> dict[str, Any]:
    """
    Resuelve todas las secciones formales del Punto de Cuenta según el proceso administrativo.
    Si el proceso está habilitado y tiene plantilla personalizada, la usa;
    de lo contrario, hace fallback automático a la plantilla general y sus valores por defecto.
    """
    titulo_gen = configuracion.get('titulo') or 'PUNTO DE CUENTA'
    encabezado_gen = configuracion.get('encabezado') or ''
    cuerpo_gen = configuracion.get('cuerpo') or ''

    plantillas = configuracion.get('plantillas_procesos') or {}
    cfg_gen = plantillas.get('general') if isinstance(plantillas.get('general'), dict) else {}

    base = {
        'titulo': titulo_gen,
        'encabezado': encabezado_gen,
        'cuerpo': cuerpo_gen,
        'presentado_a': configuracion.get('presentado_a') or cfg_gen.get('presentado_a') or PRESENTADO_A_DEFECTO,
        'cargo_presentado_a': configuracion.get('cargo_presentado_a') or cfg_gen.get('cargo_presentado_a') or CARGO_PRESENTADO_A_DEFECTO,
        'presentado_por': configuracion.get('presentado_por') or cfg_gen.get('presentado_por') or PRESENTADO_POR_DEFECTO,
        'cargo_presentado_por': configuracion.get('cargo_presentado_por') or cfg_gen.get('cargo_presentado_por') or CARGO_PRESENTADO_POR_DEFECTO,
        'unidad': configuracion.get('unidad') or cfg_gen.get('unidad') or UNIDAD_DEFECTO,
        'asunto': configuracion.get('asunto') or cfg_gen.get('asunto') or encabezado_gen or ASUNTO_DEFECTO,
        'exposicion': configuracion.get('exposicion') or cfg_gen.get('exposicion') or cuerpo_gen or EXPOSICION_DEFECTO,
        'propuesta': configuracion.get('propuesta') or cfg_gen.get('propuesta') or PROPUESTA_DEFECTO,
        'base_legal': configuracion.get('base_legal') or cfg_gen.get('base_legal') or BASE_LEGAL_DEFECTO,
        'observaciones_texto': configuracion.get('observaciones_texto') or cfg_gen.get('observaciones_texto') or '',
        'incluir_presentado_a': configuracion.get('incluir_presentado_a', cfg_gen.get('incluir_presentado_a', True)),
        'incluir_presentado_por': configuracion.get('incluir_presentado_por', cfg_gen.get('incluir_presentado_por', True)),
        'incluir_asunto': configuracion.get('incluir_asunto', cfg_gen.get('incluir_asunto', True)),
        'incluir_exposicion': configuracion.get('incluir_exposicion', cfg_gen.get('incluir_exposicion', True)),
        'incluir_propuesta': configuracion.get('incluir_propuesta', cfg_gen.get('incluir_propuesta', True)),
        'incluir_base_legal': configuracion.get('incluir_base_legal', cfg_gen.get('incluir_base_legal', True)),
        'incluir_decision': configuracion.get('incluir_decision', cfg_gen.get('incluir_decision', True)),
        'incluir_observaciones': configuracion.get('incluir_observaciones', cfg_gen.get('incluir_observaciones', True)),
        'incluir_tabla_resumen': configuracion.get('incluir_tabla_resumen', cfg_gen.get('incluir_tabla_resumen', False)),
        'incluir_firmas': configuracion.get('incluir_firmas', cfg_gen.get('incluir_firmas', True)),
    }

    if not proceso:
        return base

    cfg_proc = plantillas.get(proceso)
    if isinstance(cfg_proc, dict) and cfg_proc.get('personalizado'):
        resultado = dict(base)
        for clave, valor in cfg_proc.items():
            if clave == 'personalizado':
                continue
            if valor is not None and valor != '':
                resultado[clave] = valor
            elif isinstance(valor, bool):
                resultado[clave] = valor
        # Fallbacks específicos si solo llenaron encabezado o cuerpo en la plantilla personalizada
        if cfg_proc.get('encabezado') and not cfg_proc.get('asunto'):
            resultado['asunto'] = cfg_proc['encabezado']
        if cfg_proc.get('cuerpo') and not cfg_proc.get('exposicion'):
            resultado['exposicion'] = cfg_proc['cuerpo']
        return resultado

    return base


def resolver_plantilla_proceso(configuracion: dict, proceso: str | None = None) -> tuple[str, str, str]:
    """
    Función de compatibilidad con versiones anteriores.
    Devuelve la tupla (titulo, encabezado, cuerpo).
    """
    secciones = resolver_secciones_plantilla(configuracion, proceso)
    return secciones['titulo'], secciones['encabezado'], secciones['cuerpo']


def _reemplazar_variables(texto: str, variables: dict[str, str]) -> str:
    res = texto or ''
    for clave, val in variables.items():
        res = res.replace(f"{{{clave}}}", val or 'N/A')
    return res


def _construir_bloque_firmas(firmas: list[dict], styles: dict[str, ParagraphStyle], width: float) -> Table | None:
    if not firmas:
        return None

    filas = []
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
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    return t


def construir_pdf_punto_cuenta(dto: PuntoCuentaDTO, configuracion: dict | None = None, proceso: str | None = None) -> bytes:
    if configuracion is None:
        from apps.puntocuenta.application.use_cases.configurar_punto_cuenta import obtener_configuracion_activa
        configuracion = obtener_configuracion_activa()

    generado_en = datetime.now()
    page_config = PAGE_CONFIG['portrait']
    sample_sheet = getSampleStyleSheet()

    # Tipografía formal Arial 12pt con interlineado 1.5 (leading 17-18pt) y texto justificado (APA / APN)
    styles = {
        'Normal': ParagraphStyle(
            'PC_Normal',
            parent=sample_sheet['Normal'],
            fontName=FUENTE,
            fontSize=10,
            leading=13,
            textColor=NEGRO,
        ),
        'BodyJustified': ParagraphStyle(
            'PC_BodyJustified',
            fontName=FUENTE,
            fontSize=11.5,
            leading=16.5,
            alignment=TA_JUSTIFY,
            spaceAfter=3,
            textColor=NEGRO,
        ),
        'SectionLabel': ParagraphStyle(
            'PC_SectionLabel',
            fontName=FUENTE_NEGRITA,
            fontSize=11.5,
            leading=14,
            spaceBefore=4,
            spaceAfter=1,
            textColor=NEGRO,
        ),
        'DocNumber': ParagraphStyle(
            'PC_DocNumber',
            fontName=FUENTE_NEGRITA,
            fontSize=12,
            leading=14,
            alignment=TA_LEFT,
            textColor=NEGRO,
        ),
        'DocDate': ParagraphStyle(
            'PC_DocDate',
            fontName=FUENTE,
            fontSize=10.5,
            leading=14,
            alignment=TA_RIGHT,
            textColor=GRIS_TEXTO,
        ),
        'MetaLabel': ParagraphStyle(
            'PC_MetaLabel',
            fontName=FUENTE_NEGRITA,
            fontSize=10.5,
            leading=13,
            textColor=NEGRO,
        ),
        'MetaValue': ParagraphStyle(
            'PC_MetaValue',
            fontName=FUENTE,
            fontSize=10.5,
            leading=13,
            textColor=GRIS_TEXTO,
        ),
        'DecisionTitle': ParagraphStyle(
            'PC_DecisionTitle',
            fontName=FUENTE_NEGRITA,
            fontSize=10,
            leading=12,
            alignment=TA_CENTER,
            textColor=NEGRO,
        ),
        'DecisionBox': ParagraphStyle(
            'PC_DecisionBox',
            fontName=FUENTE_NEGRITA,
            fontSize=10,
            leading=12,
            alignment=TA_CENTER,
            textColor=GRIS_TEXTO,
        ),
        'ObservacionesGuia': ParagraphStyle(
            'PC_ObsGuia',
            fontName=FUENTE,
            fontSize=9,
            leading=12,
            textColor=GRIS_MUTED,
        ),
    }

    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_config['pagesize'],
        leftMargin=page_config['leftMargin'],
        rightMargin=page_config['rightMargin'],
        topMargin=28 * mm,
        bottomMargin=18 * mm,
        title=configuracion.get('titulo') or 'Punto de Cuenta',
        author='GATH - CONATEL',
        subject=f"Punto de cuenta generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
    )

    mostrar_nivel = configuracion.get('mostrar_nivel', True)
    origen_txt = _formatear_lugar(dto.oficina_origen, dto.dependencia_origen_nombre, mostrar_nivel)
    destino_txt = _formatear_lugar(dto.oficina_destino, dto.dependencia_destino_nombre, mostrar_nivel)
    numero_txt = dto.numero or str(dto.id)

    cargo_txt = dto.cargo_nombre or dto.cargo_codigo or (str(dto.cargo_id) if dto.cargo_id else 'N/A')
    cargo_dest_txt = getattr(dto, 'cargo_destino', None) or cargo_txt
    codigo_cargo_txt = dto.cargo_codigo or 'N/A'
    nivel_txt = getattr(dto, 'nivel', None) or dto.dependencia_destino_nombre or dto.dependencia_origen_nombre or 'Nivel Central'
    tipo_personal_txt = getattr(dto, 'tipo_personal', None) or 'PERSONAL FIJO'

    fecha_dt = None
    if dto.fecha:
        try:
            fecha_dt = datetime.fromisoformat(dto.fecha[:10])
        except Exception:
            try:
                fecha_dt = datetime.strptime(dto.fecha[:10], '%d/%m/%Y')
            except Exception:
                fecha_dt = generado_en
    else:
        fecha_dt = generado_en

    fecha_corta = fecha_dt.strftime('%d/%m/%Y')
    fecha_larga = formatear_fecha_larga(fecha_dt)

    fecha_efectiva_txt = getattr(dto, 'fecha_efectiva', None) or fecha_corta
    fecha_ingreso_txt = getattr(dto, 'fecha_ingreso', None) or 'N/A'
    anios_servicio_txt = str(getattr(dto, 'anios_servicio', None) or 'N/A')

    # Resolver secciones de la plantilla
    secciones = resolver_secciones_plantilla(configuracion, proceso)

    presentado_a_txt = getattr(dto, 'presentado_a', None) or secciones.get('presentado_a') or PRESENTADO_A_DEFECTO
    cargo_presentado_a_txt = getattr(dto, 'cargo_presentado_a', None) or secciones.get('cargo_presentado_a') or CARGO_PRESENTADO_A_DEFECTO
    presentado_por_txt = getattr(dto, 'presentado_por', None) or secciones.get('presentado_por') or PRESENTADO_POR_DEFECTO
    cargo_presentado_por_txt = getattr(dto, 'cargo_presentado_por', None) or secciones.get('cargo_presentado_por') or CARGO_PRESENTADO_POR_DEFECTO
    unidad_txt = getattr(dto, 'unidad', None) or secciones.get('unidad') or UNIDAD_DEFECTO

    variables = {
        'numero': numero_txt,
        'fecha': fecha_corta,
        'fecha_larga': fecha_larga,
        'nombre': dto.empleado_nombre or 'N/A',
        'cedula': dto.empleado_cedula or 'N/A',
        'cargo': cargo_txt,
        'cargo_destino': cargo_dest_txt,
        'codigo_cargo': codigo_cargo_txt,
        'nivel': nivel_txt,
        'tipo_personal': tipo_personal_txt,
        'origen': origen_txt,
        'destino': destino_txt,
        'motivo': dto.motivo_nombre or 'N/A',
        'fecha_efectiva': fecha_efectiva_txt,
        'fecha_ingreso': fecha_ingreso_txt,
        'anios_servicio': anios_servicio_txt,
        'presentado_a': presentado_a_txt,
        'cargo_presentado_a': cargo_presentado_a_txt,
        'presentado_por': presentado_por_txt,
        'cargo_presentado_por': cargo_presentado_por_txt,
        'unidad': unidad_txt,
    }

    # Procesar textos con las variables sustituidas
    asunto_proc = _reemplazar_variables(secciones['asunto'], variables)
    exposicion_proc = _reemplazar_variables(secciones['exposicion'], variables)
    propuesta_proc = _reemplazar_variables(secciones['propuesta'], variables)
    base_legal_proc = _reemplazar_variables(secciones['base_legal'], variables)
    obs_proc = _reemplazar_variables(secciones['observaciones_texto'], variables)
    presentado_a_proc = _reemplazar_variables(secciones['presentado_a'], variables)
    cargo_pres_a_proc = _reemplazar_variables(secciones['cargo_presentado_a'], variables)
    presentado_por_proc = _reemplazar_variables(secciones['presentado_por'], variables)
    cargo_pres_por_proc = _reemplazar_variables(secciones['cargo_presentado_por'], variables)
    unidad_proc = _reemplazar_variables(secciones['unidad'], variables)

    story = [
        Spacer(1, 4 * mm),
    ]

    # 1. Identificación del Punto de Cuenta (Número y Fecha)
    tbl_identificacion = Table([
        [
            Paragraph(f"<b>PUNTO DE CUENTA N.º</b> {escape(numero_txt)}", styles['DocNumber']),
            Paragraph(f"<b>FECHA:</b> {escape(fecha_larga)}", styles['DocDate']),
        ]
    ], colWidths=[doc.width * 0.55, doc.width * 0.45])
    tbl_identificacion.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('LINEBELOW', (0, 0), (-1, -1), 1.2, NEGRO),
    ]))
    story.append(tbl_identificacion)
    story.append(Spacer(1, 3 * mm))

    # 2. Bloque de Remisión (Presentado a / Presentado por / Unidad)
    filas_remision = []
    if secciones.get('incluir_presentado_a', True):
        destinatario_linea = f"{escape(presentado_a_proc)}"
        if cargo_pres_a_proc:
            destinatario_linea += f" — <i>{escape(cargo_pres_a_proc)}</i>"
        filas_remision.append([
            Paragraph("<b>PRESENTADO A:</b>", styles['MetaLabel']),
            Paragraph(destinatario_linea, styles['MetaValue']),
        ])

    if secciones.get('incluir_presentado_por', True):
        remitente_linea = f"{escape(presentado_por_proc)}"
        if cargo_pres_por_proc:
            remitente_linea += f" — <i>{escape(cargo_pres_por_proc)}</i>"
        filas_remision.append([
            Paragraph("<b>PRESENTADO POR:</b>", styles['MetaLabel']),
            Paragraph(remitente_linea, styles['MetaValue']),
        ])
        if unidad_proc:
            filas_remision.append([
                Paragraph("<b>UNIDAD:</b>", styles['MetaLabel']),
                Paragraph(escape(unidad_proc), styles['MetaValue']),
            ])

    if filas_remision:
        tbl_remision = Table(filas_remision, colWidths=[doc.width * 0.32, doc.width * 0.68])
        tbl_remision.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('LINEBELOW', (0, -1), (-1, -1), 0.5, GRIS_BORDE),
        ]))
        story.append(tbl_remision)
        story.append(Spacer(1, 3 * mm))

    # 3. Asunto
    if secciones.get('incluir_asunto', True) and asunto_proc.strip():
        story.append(Paragraph("<b>ASUNTO:</b>", styles['SectionLabel']))
        story.append(Paragraph(escape(asunto_proc), styles['BodyJustified']))
        story.append(Spacer(1, 2 * mm))

    # 4. Síntesis / Exposición de Motivos
    if secciones.get('incluir_exposicion', True) and exposicion_proc.strip():
        story.append(Paragraph("<b>SÍNTESIS / EXPOSICIÓN DE MOTIVOS:</b>", styles['SectionLabel']))
        for bloque in exposicion_proc.split('\n\n'):
            if bloque.strip():
                story.append(Paragraph(escape(bloque.strip()).replace('\n', '<br/>'), styles['BodyJustified']))
        story.append(Spacer(1, 2 * mm))

    # 5. Propuesta
    if secciones.get('incluir_propuesta', True) and propuesta_proc.strip():
        story.append(Paragraph("<b>PROPUESTA:</b>", styles['SectionLabel']))
        for bloque in propuesta_proc.split('\n\n'):
            if bloque.strip():
                story.append(Paragraph(escape(bloque.strip()).replace('\n', '<br/>'), styles['BodyJustified']))
        story.append(Spacer(1, 2 * mm))

    # 6. Base Legal (opcional)
    if secciones.get('incluir_base_legal', True) and base_legal_proc.strip():
        story.append(Paragraph("<b>BASE LEGAL:</b>", styles['SectionLabel']))
        for bloque in base_legal_proc.split('\n\n'):
            if bloque.strip():
                story.append(Paragraph(escape(bloque.strip()).replace('\n', '<br/>'), styles['BodyJustified']))
        story.append(Spacer(1, 2 * mm))

    # 7. Tabla resumen (QUITADA por defecto según O31; configurable si el usuario la activa)
    if secciones.get('incluir_tabla_resumen', False):
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
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ]))
        story.append(t_resumen)
        story.append(Spacer(1, 3 * mm))

    # 8. Decisión de la Autoridad (Casillas formales APN: Aprobado, Negado, Diferido, Visto)
    if secciones.get('incluir_decision', True):
        casillas = [
            [
                Paragraph("<b>DECISIÓN DE LA MÁXIMA AUTORIDAD</b>", styles['DecisionTitle']),
                Paragraph("", styles['DecisionTitle']),
                Paragraph("", styles['DecisionTitle']),
                Paragraph("", styles['DecisionTitle']),
            ],
            [
                Paragraph("[  ] <b>APROBADO</b>", styles['DecisionBox']),
                Paragraph("[  ] <b>NEGADO</b>", styles['DecisionBox']),
                Paragraph("[  ] <b>DIFERIDO</b>", styles['DecisionBox']),
                Paragraph("[  ] <b>VISTO</b>", styles['DecisionBox']),
            ],
        ]
        col_w = doc.width / 4.0
        t_decision = Table(casillas, colWidths=[col_w] * 4)
        t_decision.setStyle(TableStyle([
            ('SPAN', (0, 0), (3, 0)),
            ('BACKGROUND', (0, 0), (3, 0), GRIS_FONDO),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1, GRIS_TEXTO),
            ('INNERGRID', (0, 1), (-1, 1), 0.5, GRIS_MUTED),
            ('TOPPADDING', (0, 0), (-1, 0), 4),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
            ('TOPPADDING', (0, 1), (-1, 1), 7),
            ('BOTTOMPADDING', (0, 1), (-1, 1), 7),
        ]))
        story.append(KeepTogether([
            Spacer(1, 2 * mm),
            t_decision,
            Spacer(1, 2 * mm),
        ]))

    # 9. Observaciones / Instrucciones
    if secciones.get('incluir_observaciones', True):
        bloque_obs = [
            Paragraph("<b>OBSERVACIONES / INSTRUCCIONES:</b>", styles['SectionLabel']),
        ]
        if obs_proc.strip():
            bloque_obs.append(Paragraph(escape(obs_proc), styles['BodyJustified']))
        else:
            # Líneas guía de escritura formal
            linea_guia = "____________________________________________________________________________________"
            bloque_obs.append(Paragraph(linea_guia, styles['ObservacionesGuia']))
            bloque_obs.append(Paragraph(linea_guia, styles['ObservacionesGuia']))
        bloque_obs.append(Spacer(1, 2 * mm))
        story.append(KeepTogether(bloque_obs))

    # 10. Bloque de Firmas
    if secciones.get('incluir_firmas', True):
        firmas = configuracion.get('firmas') or []
        bloque_firmas = _construir_bloque_firmas(firmas, styles, doc.width)
        if bloque_firmas:
            story.append(KeepTogether([
                Spacer(1, 4 * mm),
                bloque_firmas,
            ]))

    config_pdf = construir_config_pdf()

    def _en_pagina(canvas, doc_):
        canvas.saveState()
        # IMPORTANTE: Se envía titulo="" a create_header para que SOLO dibuje
        # los logos y cintillo institucional, evitando duplicar el título del documento.
        for el in create_header("", width=doc_.width, config=config_pdf):
            el.wrap(doc_.width, doc_.topMargin)
            el.drawOn(canvas, doc_.leftMargin, doc_.pagesize[1] - page_config['topMargin'] + 8)
        canvas.restoreState()
        draw_footer(canvas, doc_, doc_.page, 0, f"Generado: {generado_en.strftime('%d/%m/%Y %H:%M')}", config=config_pdf)

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
        cargo_destino='COORDINADOR DE PROYECTOS',
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
        fecha_efectiva=datetime.now().strftime('%d/%m/%Y'),
        fecha_ingreso='15/03/2015',
        anios_servicio='11',
        nivel='Nivel Central',
        tipo_personal='EMPLEADO FIJO',
        presentado_a='Director(a) General de la Comisión Nacional de Telecomunicaciones',
        cargo_presentado_a='Director(a) General',
        presentado_por='Director(a) General de Gestión Humana',
        cargo_presentado_por='Director(a) General de Gestión Humana',
        unidad='Dirección General de Gestión Humana',
        documento_pdf_clave=None,
        documento_generado=False,
        numero='0001-2026',
        anio=2026,
        secuencia=1,
    )
    return construir_pdf_punto_cuenta(dto_ejemplo, configuracion, proceso=proceso)
