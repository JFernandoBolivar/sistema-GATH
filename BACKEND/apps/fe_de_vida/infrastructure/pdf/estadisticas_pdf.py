"""PDF profesional de las estadísticas de fe de vida (O21, O25).

Línea gráfica sobria y legible con la paleta institucional de CONATEL (Arial,
cintillo configurable, sin membrete, numeración «X de Y» y fecha de generación).
Totalmente condicional según las opciones elegidas por el usuario en el diálogo:
- Resumen e indicadores (KPIs, filtros y matriz)
- Gráficos estadísticos en paleta CONATEL (azules y amarillo/oro, CERO rojo)
- Listado de pasivos según alcance (faltan por responder, respondieron o ambos)
"""
from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image as ImagenPDF, KeepTogether, PageBreak, Paragraph, Spacer, Table, TableStyle

from apps.fe_de_vida.domain.entities.estadisticas import EstadisticasFeDeVida, PasivoEstadistica
from apps.fe_de_vida.domain.value_objects.estados import EstadoSolicitud
from apps.fe_de_vida.infrastructure.pdf.comun import (
    ETIQUETAS_CANAL,
    ETIQUETAS_ESTADO,
    construir_pdf,
)
from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_NEGRITA
from core.infrastructure.pdf.paleta import (
    COLOR_BARRAS_ESTADO,
    COLOR_FALTANTES,
    COLOR_RESPONDIDOS,
    GRIS_BORDE,
    GRIS_MUTED,
    GRIS_TEXTO,
)
from core.infrastructure.pdf.pdf_components import create_data_table, create_stats_box
from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG, get_paragraph_styles, get_table_style

TITULO = 'Estadísticas de fe de vida'

# Tamaños (pt) de los gráficos de respaldo dibujados con reportlab: legibles impresos.
TAM_EJES = 8
TAM_VALORES = 8.5
TAM_LEYENDA = 8.5

# Fracciones de ancho de la fila de gráficos (cobertura | tipos) y tope de alto de cada imagen.
FRACCION_COBERTURA = 0.34
FRACCION_TIPOS = 1 - FRACCION_COBERTURA
ALTO_MAXIMO_GRAFICO = 130 * mm


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
    """Barras horizontales por tipo de pasivo: etiquetas legibles y paleta CONATEL."""
    filas = list(estadisticas.conteos.por_tipo)[:8]
    dibujo = Drawing(ancho, 50 * mm)
    if not filas:
        dibujo.add(String(8, 25 * mm, 'Sin datos para los filtros aplicados.', fontName=FUENTE, fontSize=8, fillColor=GRIS_MUTED))
        return dibujo

    grafico = HorizontalBarChart()
    grafico.x, grafico.y = 36 * mm, 8 * mm
    grafico.width, grafico.height = ancho - 40 * mm, 32 * mm
    grafico.data = [
        [f.respondieron for f in filas],
        [f.faltan for f in filas],
    ]
    grafico.categoryAxis.categoryNames = [(f.tipo_nomina or 'Sin tipo')[:28] for f in filas]
    grafico.categoryAxis.labels.fontName = FUENTE
    grafico.categoryAxis.labels.fontSize = TAM_EJES
    grafico.valueAxis.labels.fontName = FUENTE
    grafico.valueAxis.labels.fontSize = TAM_EJES
    grafico.valueAxis.valueMin = 0
    max_val = max([f.total for f in filas] or [1])
    grafico.valueAxis.valueStep = max(1, (max_val // 5) or 1)
    grafico.barLabelFormat = '%d'
    grafico.barLabels.fontName = FUENTE_NEGRITA
    grafico.barLabels.fontSize = TAM_VALORES
    grafico.barLabels.nudge = 7
    grafico.bars[0].fillColor = COLOR_RESPONDIDOS
    grafico.bars[1].fillColor = COLOR_FALTANTES
    grafico.groupSpacing = 6
    dibujo.add(grafico)

    dibujo.add(String(36 * mm, 45 * mm, '■ Respondieron', fontName=FUENTE_NEGRITA, fontSize=TAM_LEYENDA, fillColor=COLOR_RESPONDIDOS))
    dibujo.add(String(72 * mm, 45 * mm, '■ Faltan', fontName=FUENTE_NEGRITA, fontSize=TAM_LEYENDA, fillColor=GRIS_TEXTO))
    return dibujo


def _grafico_estados(estadisticas: EstadisticasFeDeVida, ancho: float) -> Drawing:
    """Gráfico horizontal en azul institucional para solicitudes por estado."""
    filas = list(estadisticas.conteos.por_estado)
    dibujo = Drawing(ancho, 56 * mm)
    if not filas:
        dibujo.add(String(10, 26 * mm, 'Sin solicitudes con los filtros aplicados.', fontName=FUENTE, fontSize=9, fillColor=GRIS_MUTED))
        return dibujo

    grafico = HorizontalBarChart()
    grafico.x, grafico.y = 42 * mm, 10 * mm
    grafico.width, grafico.height = ancho - 52 * mm, 40 * mm
    grafico.data = [[f.total for f in filas]]
    grafico.categoryAxis.categoryNames = [ETIQUETAS_ESTADO.get(f.estado, f.estado) for f in filas]
    grafico.categoryAxis.labels.fontName = FUENTE
    grafico.categoryAxis.labels.fontSize = TAM_EJES
    grafico.valueAxis.labels.fontName = FUENTE
    grafico.valueAxis.labels.fontSize = TAM_EJES
    grafico.valueAxis.valueMin = 0
    grafico.barLabelFormat = '%d'
    grafico.barLabels.fontName = FUENTE_NEGRITA
    grafico.barLabels.fontSize = TAM_VALORES
    grafico.barLabels.nudge = 7
    grafico.bars[0].fillColor = COLOR_BARRAS_ESTADO
    dibujo.add(grafico)
    return dibujo


def _imagen_grafico(datos: bytes, ancho: float, alto_maximo: float = ALTO_MAXIMO_GRAFICO) -> ImagenPDF:
    """PNG de la copia de exportación (ancho lógico a medida del hueco), sin deformar.

    El frontend dibuja cada gráfico con un ancho lógico pensado para su hueco
    (`ANCHOS_EXPORTACION` en graficos-estadisticas.tsx), de modo que el escalado
    sea cercano a 0,75 pt/px y el texto de 13 px salga a ~10 pt (página horizontal). Si se cambian las
    fracciones de ancho de abajo, hay que ajustar esos anchos.
    """
    lector = ImageReader(BytesIO(datos))
    ancho_px, alto_px = lector.getSize()
    alto = ancho * (alto_px / ancho_px) if ancho_px else alto_maximo
    if alto > alto_maximo:
        alto = alto_maximo
        ancho = alto * (ancho_px / alto_px)
    return ImagenPDF(BytesIO(datos), width=ancho, height=alto)


def _grafico_cobertura(estadisticas: EstadisticasFeDeVida, ancho: float) -> Drawing:
    """Respaldo del gráfico de cobertura cuando la pantalla no envía su PNG."""
    conteos = estadisticas.conteos
    dibujo = Drawing(ancho, 48 * mm)
    if not conteos.total:
        dibujo.add(String(6, 22 * mm, 'Sin pasivos para los filtros aplicados.', fontName=FUENTE, fontSize=8, fillColor=GRIS_MUTED))
        return dibujo
    pastel = Pie()
    pastel.x, pastel.y = 1 * mm, 2 * mm
    pastel.width = pastel.height = 32 * mm
    pastel.data = [conteos.respondieron, conteos.faltan]
    pastel.slices[0].fillColor = COLOR_RESPONDIDOS
    pastel.slices[1].fillColor = COLOR_FALTANTES
    pastel.slices[0].strokeColor = pastel.slices[1].strokeColor = None
    pastel.sideLabels = False
    pastel.simpleLabels = 0
    dibujo.add(pastel)
    dibujo.add(String(36 * mm, 44 * mm, f'■ Respondieron: {conteos.respondieron}', fontName=FUENTE_NEGRITA, fontSize=TAM_LEYENDA, fillColor=COLOR_RESPONDIDOS))
    dibujo.add(String(36 * mm, 39 * mm, f'■ Faltan: {conteos.faltan}', fontName=FUENTE_NEGRITA, fontSize=TAM_LEYENDA, fillColor=GRIS_TEXTO))
    dibujo.add(String(36 * mm, 30 * mm, f'Total: {conteos.total}', fontName=FUENTE, fontSize=TAM_LEYENDA, fillColor=GRIS_TEXTO))
    return dibujo


def _tabla_matriz(estadisticas: EstadisticasFeDeVida, ancho: float) -> Table:
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


def _listado(pasivos: list[PasivoEstadistica], *, solo_faltantes: bool, ancho: float) -> Table:
    columnas = ['#', 'cedula', 'nombre_completo', 'tipo_nomina', 'correo', 'telefono']
    if not solo_faltantes:
        columnas += ['estado', 'canal', 'fecha_envio']
    filas = []
    for indice, pasivo in enumerate(pasivos, start=1):
        fila = {
            '#': indice,
            'cedula': pasivo.cedula,
            'nombre_completo': pasivo.nombre_completo,
            'tipo_nomina': pasivo.tipo_nomina,
            'correo': pasivo.correo,
            'telefono': pasivo.telefono,
            'estado': ETIQUETAS_ESTADO.get(pasivo.estado, pasivo.estado),
            'canal': ETIQUETAS_CANAL.get(pasivo.canal, pasivo.canal),
            'fecha_envio': pasivo.fecha_envio.strftime('%d/%m/%Y %H:%M') if pasivo.fecha_envio else '',
        }
        filas.append(fila)

    if solo_faltantes:
        proporcion = [8, 22, 62, 34, 55, 30]
    else:
        proporcion = [8, 18, 48, 28, 44, 26, 26, 22, 32]

    col_widths = [p / sum(proporcion) * ancho for p in proporcion]
    return create_data_table(columnas, filas, col_widths=col_widths)


def generar_estadisticas_pdf(
    estadisticas: EstadisticasFeDeVida,
    pasivos: list[PasivoEstadistica] | None = None,
    *,
    faltantes: bool = False,
    incluir_resumen: bool = True,
    incluir_graficos: bool = True,
    incluir_listado: bool = True,
    alcance_listado: str = 'faltan',
    imagenes: dict[str, bytes] | None = None,
    config: dict | None = None,
) -> bytes:
    """Construye el PDF de estadísticas respetando las secciones solicitadas."""
    generado_en = datetime.now()
    imagenes = imagenes or {}
    page_config = PAGE_CONFIG['landscape']
    estilos = get_paragraph_styles()
    ancho = page_config['pagesize'][0] - page_config['leftMargin'] - page_config['rightMargin']
    tipos = {t.id: t.nombre for t in estadisticas.tipos}
    pasivos = pasivos or []

    # Normalización del alcance del listado
    alcance = (alcance_listado or ('faltan' if faltantes else 'celda')).lower().strip()
    solo_faltantes = alcance in ('faltan', 'faltantes')

    story = []

    # ── Encabezado principal ──
    if estadisticas.proceso:
        story.append(Paragraph(
            f"<b>{escape(estadisticas.proceso.nombre)}</b> · {escape(estadisticas.proceso.estado.title())}",
            estilos['Title'],
        ))
    else:
        story.append(Paragraph('Sin proceso de fe de vida vigente', estilos['Title']))
    story.append(Paragraph(
        f"Documento generado el {generado_en.strftime('%d/%m/%Y %H:%M')}",
        estilos['CenterSmall'],
    ))
    story.append(Spacer(1, 3 * mm))

    # ── Filtros aplicados (siempre útiles para contexto) ──
    story.append(Paragraph('<b>Filtros aplicados</b>', estilos['TableCell']))
    for etiqueta, valor in _texto_filtros(estadisticas, tipos):
        story.append(Paragraph(f'<b>{escape(etiqueta)}:</b> {escape(str(valor))}', estilos['TableCell']))
    story.append(Spacer(1, 3 * mm))

    # ── Sección 1: Resumen e indicadores ──
    if incluir_resumen:
        conteos = estadisticas.conteos
        story.append(create_stats_box({
            'Total de pasivos': conteos.total,
            'Respondieron': f'{conteos.respondieron} ({estadisticas.porcentaje_respondieron:.1f}%)',
            'Faltan por responder': f'{conteos.faltan} ({estadisticas.porcentaje_faltan:.1f}%)',
            'Validadas': f'{conteos.validadas} ({estadisticas.porcentaje_validadas:.1f}%)',
        }, width=ancho))
        story.append(Spacer(1, 4 * mm))

    # ── Sección 2: Gráficos estadísticos ──
    if incluir_graficos:
        conteos = estadisticas.conteos
        ancho_cobertura = ancho * FRACCION_COBERTURA
        ancho_tipos = ancho * FRACCION_TIPOS
        cobertura = (
            _imagen_grafico(imagenes['cobertura'], ancho_cobertura)
            if imagenes.get('cobertura') else _grafico_cobertura(estadisticas, ancho_cobertura)
        )
        tipos = (
            _imagen_grafico(imagenes['tipos'], ancho_tipos)
            if imagenes.get('tipos') else _grafico_tipos(estadisticas, ancho_tipos)
        )
        fila_graficos = Table([[
            [Paragraph('<b>Cobertura de la fe de vida</b>', estilos['TableCell']), cobertura],
            [Paragraph('<b>Respondieron por tipo de pasivo</b>', estilos['TableCell']), tipos],
        ]], colWidths=[ancho * FRACCION_COBERTURA, ancho * FRACCION_TIPOS])
        fila_graficos.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(fila_graficos)
        story.append(Spacer(1, 3 * mm))

        estados = (
            _imagen_grafico(imagenes['estados'], ancho)
            if imagenes.get('estados') else _grafico_estados(estadisticas, ancho)
        )
        story.append(KeepTogether([
            Paragraph('<b>Solicitudes por estado</b>', estilos['TableCell']),
            estados,
        ]))
        if conteos.por_canal:
            canales = ' · '.join(
                f"{ETIQUETAS_CANAL.get(c.canal, c.canal)}: {c.total}" for c in conteos.por_canal
            )
            story.append(Paragraph(f'<b>Canales de recepción:</b> {escape(canales)}', estilos['TableCell']))
        story.append(Spacer(1, 3 * mm))

    # Matriz en la sección de resumen
    if incluir_resumen:
        story.append(Paragraph('<b>Matriz tipo de pasivo × estado</b>', estilos['TableCell']))
        story.append(_tabla_matriz(estadisticas, ancho))
        story.append(Spacer(1, 3 * mm))

    # ── Sección 3: Listado de pasivos ──
    if incluir_listado:
        # Salto de página si ya hubo resumen o gráficos previos
        if incluir_resumen or incluir_graficos:
            story.append(PageBreak())

        if alcance in ('faltan', 'faltantes'):
            titulo_detalle = 'Detalle de pasivos: Faltan por responder'
        elif alcance in ('respondieron', 'respondidas'):
            titulo_detalle = 'Detalle de pasivos: Respondieron (con fe de vida enviada)'
        elif alcance == 'ambos':
            titulo_detalle = 'Detalle general de pasivos obligados'
        else:
            titulo_detalle = (
                'Detalle de la casilla: '
                + ETIQUETAS_ESTADO.get(estadisticas.filtro.estado or '', estadisticas.filtro.estado or '')
                + (
                    f" · {tipos.get(estadisticas.filtro.tipo_nomina_id, '')}"
                    if estadisticas.filtro.tipo_nomina_id else ''
                )
            )

        story.append(Paragraph(f'<b>{escape(titulo_detalle)}</b>', estilos['Title']))
        story.append(Paragraph(f'{len(pasivos)} registro(s) encontrado(s)', estilos['CenterSmall']))
        story.append(Spacer(1, 3 * mm))
        if pasivos:
            story.append(_listado(pasivos, solo_faltantes=solo_faltantes, ancho=ancho))
        else:
            story.append(Paragraph('No hay pasivos que coincidan con los filtros aplicados.', estilos['TableCell']))

    return construir_pdf(TITULO, story, config=config, generado_en=generado_en, orientation='landscape')
