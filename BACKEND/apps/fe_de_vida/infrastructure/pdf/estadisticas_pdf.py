"""PDF profesional de las estadísticas de fe de vida (O21).

Misma línea gráfica de los PDF del sistema: Arial, cintillo configurable, sin
membrete institucional. Incluye resumen con KPI y gráficos, filtros aplicados,
matriz tipo × estado y el listado con encabezado repetido y numeración de
páginas «X de Y».
"""
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, Spacer, Table

from apps.fe_de_vida.domain.entities.estadisticas import EstadisticasFeDeVida, PasivoEstadistica
from apps.fe_de_vida.domain.value_objects.estados import EstadoSolicitud
from apps.fe_de_vida.infrastructure.pdf.comun import (
    ETIQUETAS_CANAL,
    ETIQUETAS_ESTADO,
    construir_pdf,
)
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from core.infrastructure.pdf.pdf_components import create_data_table, create_stats_box
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG, get_paragraph_styles, get_table_style

TITULO = 'Estadísticas de fe de vida'
AZUL = colors.HexColor('#1a237e')
GRIS = colors.HexColor('#9e9e9e')


def _texto_filtros(estadisticas: EstadisticasFeDeVida, tipos: dict[int, str]) -> list[tuple[str, str]]:
    filtro = estadisticas.filtro
    proceso = estadisticas.proceso.nombre if estadisticas.proceso else 'Sin proceso'
    pares = [('Proceso', proceso)]
    if filtro.tipo_nomina_id:
        pares.append(('Tipo de pasivo', tipos.get(filtro.tipo_nomina_id, str(filtro.tipo_nomina_id))))
    if filtro.estado:
        pares.append(('Estado', ETIQUETAS_ESTADO.get(filtro.estado, filtro.estado)))
    if filtro.canal:
        pares.append(('Canal', ETIQUETAS_CANAL.get(filtro.canal, filtro.canal)))
    if filtro.desde:
        pares.append(('Enviadas desde', filtro.desde.strftime('%d/%m/%Y')))
    if filtro.hasta:
        pares.append(('Enviadas hasta', filtro.hasta.strftime('%d/%m/%Y')))
    return pares


def _grafico_tipos(estadisticas: EstadisticasFeDeVida, ancho: float) -> Drawing:
    filas = list(estadisticas.conteos.por_tipo)[:8]
    dibujo = Drawing(ancho, 60 * mm)
    if not filas:
        dibujo.add(String(10, 30 * mm, 'Sin datos para los filtros aplicados.', fontName=FUENTE, fontSize=9, fillColor=GRIS))
        return dibujo
    grafico = VerticalBarChart()
    grafico.x, grafico.y = 18 * mm, 20 * mm
    grafico.width, grafico.height = ancho - 24 * mm, 34 * mm
    grafico.data = [
        [f.respondieron for f in filas],
        [f.faltan for f in filas],
    ]
    nombres = [(f.tipo_nomina or 'Sin tipo')[:18] for f in filas]
    grafico.categoryAxis.categoryNames = nombres
    grafico.categoryAxis.labels.fontName = FUENTE
    grafico.categoryAxis.labels.fontSize = 6.5
    grafico.categoryAxis.labels.angle = 20
    grafico.categoryAxis.labels.dx = -4
    grafico.categoryAxis.labels.dy = -6
    grafico.valueAxis.labels.fontName = FUENTE
    grafico.valueAxis.labels.fontSize = 6.5
    grafico.valueAxis.valueMin = 0
    grafico.valueAxis.valueStep = max(1, (max([f.total for f in filas] or [1]) // 5) or 1)
    grafico.bars[0].fillColor = AZUL
    grafico.bars[1].fillColor = colors.HexColor('#e57373')
    grafico.groupSpacing = 8
    dibujo.add(grafico)
    dibujo.add(String(18 * mm, 55 * mm, 'Respondieron', fontName=FUENTE_NEGRITA, fontSize=7, fillColor=AZUL))
    dibujo.add(String(52 * mm, 55 * mm, 'Faltan', fontName=FUENTE_NEGRITA, fontSize=7, fillColor=colors.HexColor('#c62828')))
    return dibujo


def _grafico_estados(estadisticas: EstadisticasFeDeVida, ancho: float) -> Drawing:
    filas = list(estadisticas.conteos.por_estado)
    dibujo = Drawing(ancho, 60 * mm)
    if not filas:
        dibujo.add(String(10, 30 * mm, 'Sin solicitudes con los filtros aplicados.', fontName=FUENTE, fontSize=9, fillColor=GRIS))
        return dibujo
    grafico = HorizontalBarChart()
    grafico.x, grafico.y = 38 * mm, 12 * mm
    grafico.width, grafico.height = ancho - 46 * mm, 44 * mm
    grafico.data = [[f.total for f in filas]]
    grafico.categoryAxis.categoryNames = [ETIQUETAS_ESTADO.get(f.estado, f.estado) for f in filas]
    grafico.categoryAxis.labels.fontName = FUENTE
    grafico.categoryAxis.labels.fontSize = 7
    grafico.valueAxis.labels.fontName = FUENTE
    grafico.valueAxis.labels.fontSize = 7
    grafico.valueAxis.valueMin = 0
    grafico.bars[0].fillColor = colors.HexColor('#3949ab')
    dibujo.add(grafico)
    return dibujo


def _tabla_matriz(estadisticas: EstadisticasFeDeVida, ancho: float):
    estados = [e.value for e in EstadoSolicitud]
    filas_por_tipo = {f.tipo_nomina_id: f for f in estadisticas.conteos.por_tipo}
    celdas = {(f.tipo_nomina_id, f.estado): f.total for f in estadisticas.conteos.matriz}
    estilos = get_paragraph_styles()
    cabecera = [Paragraph('Tipo de pasivo', estilos['TableHeader'])] + [
        Paragraph(escape(ETIQUETAS_ESTADO[estado]), estilos['TableHeader']) for estado in estados
    ] + [Paragraph('Total', estilos['TableHeader'])]
    datos = [cabecera]
    for tipo_id, fila in filas_por_tipo.items():
        valores = {estado: celdas.get((tipo_id, estado), 0) for estado in estados}
        datos.append([
            Paragraph(escape(fila.tipo_nomina), estilos['TableCell']),
            *[Paragraph(str(valores[estado]), estilos['TableCell']) for estado in estados],
            Paragraph(str(sum(valores.values())), estilos['TableCell']),
        ])
    anchos = [40 * mm] + [(ancho - 40 * mm - 14 * mm) / len(estados)] * len(estados) + [14 * mm]
    tabla = Table(datos, colWidths=anchos, repeatRows=1)
    tabla.setStyle(get_table_style())
    return tabla


def _listado(pasivos: list[PasivoEstadistica], *, faltantes: bool, ancho: float):
    columnas = ['#', 'cedula', 'nombre_completo', 'tipo_nomina', 'correo', 'telefono']
    if not faltantes:
        columnas += ['estado', 'canal', 'fecha_envio']
    filas = []
    for indice, pasivo in enumerate(pasivos, start=1):
        fila = {
            '#': indice, 'cedula': pasivo.cedula, 'nombre_completo': pasivo.nombre_completo,
            'tipo_nomina': pasivo.tipo_nomina, 'correo': pasivo.correo, 'telefono': pasivo.telefono,
            'estado': ETIQUETAS_ESTADO.get(pasivo.estado, pasivo.estado),
            'canal': ETIQUETAS_CANAL.get(pasivo.canal, pasivo.canal),
            'fecha_envio': pasivo.fecha_envio.strftime('%d/%m/%Y %H:%M') if pasivo.fecha_envio else '',
        }
        filas.append(fila)
    proporcion = {
        6: [8, 22, 62, 34, 55, 30],
        9: [8, 18, 48, 28, 44, 26, 26, 22, 32],
    }[len(columnas)]
    tabla = create_data_table(columnas, filas, col_widths=[p / sum(proporcion) * ancho for p in proporcion])
    return tabla


def generar_estadisticas_pdf(
    estadisticas: EstadisticasFeDeVida,
    pasivos: list[PasivoEstadistica],
    *,
    faltantes: bool,
    config: dict | None = None,
) -> bytes:
    generado_en = datetime.now()
    page_config = PAGE_CONFIG['landscape']
    estilos = get_paragraph_styles()
    ancho = page_config['pagesize'][0] - page_config['leftMargin'] - page_config['rightMargin']
    tipos = {t.id: t.nombre for t in estadisticas.tipos}

    story = []
    if estadisticas.proceso:
        story.append(Paragraph(
            f"<b>{escape(estadisticas.proceso.nombre)}</b> · {escape(estadisticas.proceso.estado.title())}",
            estilos['Title'],
        ))
    else:
        story.append(Paragraph('Sin proceso de fe de vida', estilos['Title']))
    story.append(Paragraph(
        f"Documento generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
        estilos['CenterSmall'],
    ))
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph('<b>Filtros aplicados</b>', estilos['TableCell']))
    for etiqueta, valor in _texto_filtros(estadisticas, tipos):
        story.append(Paragraph(f'<b>{escape(etiqueta)}:</b> {escape(str(valor))}', estilos['TableCell']))
    story.append(Spacer(1, 3 * mm))

    conteos = estadisticas.conteos
    story.append(create_stats_box({
        'Total de pasivos': conteos.total,
        'Respondieron': f'{conteos.respondieron} ({estadisticas.porcentaje_respondieron:.1f}%)',
        'Faltan por responder': f'{conteos.faltan} ({estadisticas.porcentaje_faltan:.1f}%)',
        'Validadas': f'{conteos.validadas} ({estadisticas.porcentaje_validadas:.1f}%)',
    }, width=ancho))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph('<b>Respondieron por tipo de pasivo</b>', estilos['TableCell']))
    story.append(_grafico_tipos(estadisticas, ancho))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph('<b>Solicitudes por estado</b>', estilos['TableCell']))
    story.append(_grafico_estados(estadisticas, ancho))
    if conteos.por_canal:
        canales = ' · '.join(
            f"{ETIQUETAS_CANAL.get(c.canal, c.canal)}: {c.total}" for c in conteos.por_canal
        )
        story.append(Paragraph(f'<b>Canal:</b> {escape(canales)}', estilos['TableCell']))
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph('<b>Matriz tipo de pasivo × estado</b>', estilos['TableCell']))
    story.append(_tabla_matriz(estadisticas, ancho))

    story.append(PageBreak())
    titulo_detalle = 'Detalle: faltan por responder' if faltantes else (
        'Detalle de la casilla: '
        + ETIQUETAS_ESTADO.get(estadisticas.filtro.estado or '', estadisticas.filtro.estado or '')
        + (
            f" · {tipos.get(estadisticas.filtro.tipo_nomina_id, '')}"
            if estadisticas.filtro.tipo_nomina_id else ''
        )
    )
    story.append(Paragraph(f'<b>{escape(titulo_detalle)}</b>', estilos['Title']))
    story.append(Paragraph(f'{len(pasivos)} registro(s)', estilos['CenterSmall']))
    story.append(Spacer(1, 3 * mm))
    if pasivos:
        story.append(_listado(pasivos, faltantes=faltantes, ancho=ancho))
    else:
        story.append(Paragraph('No hay pasivos que coincidan con los filtros aplicados.', estilos['TableCell']))

    return construir_pdf(TITULO, story, config=config, generado_en=generado_en, orientation='landscape')
