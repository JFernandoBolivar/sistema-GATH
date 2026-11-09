"""
Componentes de maquetación del PDF «Expediente del trabajador»: tarjeta de
identificación, títulos de sección, grillas etiqueta/valor y tablas con
anchos proporcionales. Tipografía: Arial (ver `core.infrastructure.pdf.fuentes`).
"""
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import KeepTogether, Paragraph, Spacer, Table, TableStyle

AZUL = colors.HexColor('#0B4A9E')
AZUL_OSCURO = colors.HexColor('#0A2F66')
AZUL_CLARO = colors.HexColor('#E8EEF8')
GRIS_BORDE = colors.HexColor('#D5DAE3')
GRIS_ETIQUETA = colors.HexColor('#6B7280')
ZEBRA = colors.HexColor('#F7F9FC')
NEGRO = colors.HexColor('#111827')

from core.infrastructure.pdf.fuentes import FUENTE, FUENTE_CURSIVA, FUENTE_NEGRITA  # noqa: E402

SANS, SANS_B, SANS_I = FUENTE, FUENTE_NEGRITA, FUENTE_CURSIVA

_ESTILOS = {
    'nombre': ParagraphStyle('ExpNombre', fontName=SANS_B, fontSize=15, leading=18, textColor=NEGRO),
    'sub': ParagraphStyle('ExpSub', fontName=SANS, fontSize=9.5, leading=13, textColor=colors.HexColor('#374151')),
    'seccion': ParagraphStyle('ExpSeccion', fontName=SANS_B, fontSize=10.5, leading=13, textColor=AZUL, alignment=TA_LEFT),
    'etiqueta': ParagraphStyle('ExpEtiqueta', fontName=SANS, fontSize=8, leading=10, textColor=GRIS_ETIQUETA),
    'valor': ParagraphStyle('ExpValor', fontName=SANS, fontSize=9.5, leading=12, textColor=NEGRO),
    'th': ParagraphStyle('ExpTh', fontName=SANS_B, fontSize=8.5, leading=10.5, textColor=AZUL_OSCURO),
    'td': ParagraphStyle('ExpTd', fontName=SANS, fontSize=8.5, leading=11, textColor=NEGRO),
    'vacio': ParagraphStyle('ExpVacio', fontName=SANS_I, fontSize=9, leading=12, textColor=GRIS_ETIQUETA),
}


def _p(texto: str, estilo: str) -> Paragraph:
    return Paragraph(escape(str(texto)), _ESTILOS[estilo])


def titulo_seccion(titulo: str, ancho: float) -> Table:
    t = Table([[_p(titulo.upper(), 'seccion')]], colWidths=[ancho])
    t.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, 0), 0.75, AZUL),
        ('LINEBEFORE', (0, 0), (0, 0), 3, AZUL),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return t


def seccion(titulo: str, cuerpo, ancho: float) -> list:
    """Título + cuerpo; el título viaja junto al primer bloque (nunca queda solo).

    Si la sección no cabe entera pero quedan más de `_ESPACIO_MINIMO` puntos en
    la hoja, se parte ahí (las tablas repiten su encabezado) en vez de saltar
    de página dejando un hueco en blanco; con menos espacio, pasa completa a
    la hoja siguiente.
    """
    bloques = cuerpo if isinstance(cuerpo, list) else [cuerpo]
    for b in bloques:
        if isinstance(b, TablaSeccion):
            b.titulo_seccion, b.ancho_titulo = titulo, ancho
    return [
        Spacer(1, 14),
        KeepTogether(
            [titulo_seccion(titulo, ancho), Spacer(1, 6), *bloques],
            maxHeight=_ESPACIO_MINIMO,
        ),
    ]


# Alto mínimo (pt) que debe quedar en la hoja para empezar una sección partida:
# el título y al menos un par de filas.
_ESPACIO_MINIMO = 140


def nota_gris(texto: str) -> Paragraph:
    return Paragraph(escape(texto), ParagraphStyle('ExpNota', parent=_ESTILOS['vacio'], fontSize=7.5, leading=10))


def sin_registros() -> Paragraph:
    return _p('Sin registros.', 'vacio')


def grilla(pares: list[tuple[str, str]], ancho: float, columnas: int = 2) -> Table:
    """Pares etiqueta/valor en `columnas` columnas (etiqueta sobre el valor)."""
    filas = []
    for i in range(0, len(pares), columnas):
        fila = []
        for etiqueta, valor in pares[i:i + columnas]:
            fila.append([_p(etiqueta, 'etiqueta'), _p(valor, 'valor')])
        while len(fila) < columnas:
            fila.append('')
        filas.append(fila)
    t = Table(filas, colWidths=[ancho / columnas] * columnas)
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, -1), SANS),  # celdas vacías: Arial, no Helvetica
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


class TablaSeccion(Table):
    """Tabla de una sección: si se parte entre páginas, la parte que sigue lleva
    arriba «<Título> (continuación)» además de repetir los encabezados."""

    titulo_seccion: str | None = None
    ancho_titulo: float = 0

    def split(self, availWidth, availHeight):
        partes = super().split(availWidth, availHeight)
        if len(partes) != 2 or not self.titulo_seccion:
            return partes
        primera, resto = partes
        resto.titulo_seccion, resto.ancho_titulo = self.titulo_seccion, self.ancho_titulo
        return [primera, KeepTogether([
            titulo_seccion(f"{self.titulo_seccion} (continuación)", self.ancho_titulo),
            Spacer(1, 6),
            resto,
        ])]


def tabla(columnas: list[str], filas: list[list[str]], pesos: list[float], ancho: float) -> Table:
    total = float(sum(pesos))
    anchos = [ancho * p / total for p in pesos]
    datos = [[_p(c, 'th') for c in columnas]] + [[_p(c, 'td') for c in fila] for fila in filas]
    t = TablaSeccion(datos, colWidths=anchos, repeatRows=1)
    estilo = [
        ('FONTNAME', (0, 0), (-1, -1), SANS),
        ('BACKGROUND', (0, 0), (-1, 0), AZUL_CLARO),
        ('LINEBELOW', (0, 0), (-1, 0), 0.75, AZUL),
        ('GRID', (0, 0), (-1, -1), 0.4, GRIS_BORDE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(2, len(datos), 2):
        estilo.append(('BACKGROUND', (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(estilo))
    return t


def tarjeta_identificacion(nombre: str, lineas: list[str], ancho: float, foto=None) -> Table:
    """Tarjeta con borde suave: nombre grande, líneas de detalle y foto opcional a la derecha."""
    texto = [[_p(nombre, 'nombre')]] + [[_p(linea, 'sub')] for linea in lineas]
    bloque = Table(texto)
    bloque.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 1), ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    if foto is not None:
        ancho_foto = 30 * 2.8346 + 6
        datos, anchos = [[bloque, foto]], [ancho - ancho_foto - 12, ancho_foto + 12]
    else:
        datos, anchos = [[bloque]], [ancho]
    t = Table(datos, colWidths=anchos)
    t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, GRIS_BORDE),
        ('LINEBEFORE', (0, 0), (0, 0), 3, AZUL),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FAFBFD')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    return t
