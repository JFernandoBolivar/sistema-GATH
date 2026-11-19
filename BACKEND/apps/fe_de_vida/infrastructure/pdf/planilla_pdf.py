"""Planilla de fe de vida en PDF (una por solicitud VALIDADA).

Diseño de ficha institucional: cabecera con logos/cintillo, tarjeta de identificación, evidencia
fotográfica adaptada a su orientación y secciones de datos sin cuadrículas. Se alimenta de la
instantánea aprobada (`ConstanciaFeDeVida.datos_planilla`), no del expediente actual.
"""
from datetime import date, datetime
from html import escape as _escape
from io import BytesIO

from django.utils import timezone
from PIL import Image as Imagen, ImageOps
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, Paragraph, Spacer, Table, TableStyle

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.fe_de_vida.infrastructure.pdf.comun import construir_pdf
from core.infrastructure.pdf.paleta import (
    AMARILLO_ACENTO,
    AMARILLO_SUAVE,
    AZUL_CLARO,
    AZUL_CONATEL,
    AZUL_OSCURO,
    BLANCO,
    GRIS_BORDE,
    GRIS_FONDO,
    GRIS_MUTED,
    GRIS_TEXTO,
)
from core.infrastructure.pdf.pdf_styles import FONTS, PAGE_CONFIG
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

TITULO = 'Planilla de fe de vida'
ANCHO_FOTO_VERTICAL = 45 * mm
ALTO_FOTO_VERTICAL = 60 * mm
ANCHO_FOTO_HORIZONTAL = 140 * mm
ALTO_FOTO_HORIZONTAL = 70 * mm
NOTA_SIN_FOTO = (
    'La evidencia fotográfica de esta solicitud no se encuentra disponible (política de retención '
    'o registro histórico). Los datos mostrados corresponden a la información aprobada.'
)


def _texto(valor) -> str:
    return '' if valor is None else str(valor).strip()


def _fecha_civil(valor) -> str:
    valor = _texto(valor)
    if not valor:
        return '—'
    try:
        return date.fromisoformat(valor[:10]).strftime('%d/%m/%Y')
    except ValueError:
        return valor


def _fecha_hora(valor) -> str:
    valor = _texto(valor)
    if not valor:
        return '—'
    try:
        momento = datetime.fromisoformat(valor.replace('Z', '+00:00'))
    except ValueError:
        return valor
    if momento.tzinfo is not None:
        momento = timezone.localtime(momento)
    return momento.strftime('%d/%m/%Y %H:%M')


def _cargar_foto(datos: dict) -> tuple[BytesIO | None, float | None]:
    """JPEG normalizado y relación ancho/alto; `(None, None)` si no está disponible."""
    clave = _texto((datos.get('foto') or {}).get('clave'))
    if not clave:
        return None, None
    try:
        contenido = SeaweedFSStorage().descargar(clave)
        with Imagen.open(BytesIO(contenido)) as original:
            imagen = ImageOps.exif_transpose(original).convert('RGB')
            imagen.thumbnail((1600, 1600))
            salida = BytesIO()
            imagen.save(salida, format='JPEG', quality=88, optimize=True)
            ancho, alto = imagen.size
        salida.seek(0)
        return salida, ancho / alto if alto else None
    except Exception:  # noqa: BLE001 - la planilla debe salir aunque el almacén falle
        return None, None


def _imagen(buffer: BytesIO, max_ancho: float, max_alto: float) -> Image:
    from PIL import Image as _PIL

    with _PIL.open(BytesIO(buffer.getvalue())) as imagen:
        ancho, alto = imagen.size
    escala = min(max_ancho / ancho, max_alto / alto)
    buffer.seek(0)
    return Image(buffer, width=ancho * escala, height=alto * escala)


def _placeholder(ancho: float, alto: float) -> Table:
    estilo = ParagraphStyle(
        'FotoNoDisponible', fontName=FONTS['small'][0], fontSize=8, textColor=GRIS_MUTED,
        alignment=TA_CENTER, leading=10,
    )
    caja = Table([[Paragraph('Foto no disponible', estilo)]], colWidths=[ancho], rowHeights=[alto])
    caja.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.6, GRIS_BORDE),
        ('BACKGROUND', (0, 0), (-1, -1), GRIS_FONDO),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    return caja


def _titulo_seccion(texto: str, ancho: float) -> Table:
    estilo = ParagraphStyle(
        'TituloSeccionPlanilla', fontName=FONTS['header_cell'][0], fontSize=8.5,
        textColor=AZUL_CONATEL, leading=11,
    )
    titulo = Table([[Paragraph(_escape(texto.upper()), estilo)]], colWidths=[ancho])
    titulo.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), AZUL_CLARO),
        ('LINEBEFORE', (0, 0), (0, 0), 3, AZUL_CONATEL),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return titulo


def _par(etiqueta: str, valor: str) -> list:
    estilo_etiqueta = ParagraphStyle(
        'EtiquetaPlanilla', fontName=FONTS['small'][0], fontSize=7, textColor=GRIS_MUTED,
        leading=9, spaceAfter=1,
    )
    estilo_valor = ParagraphStyle(
        'ValorPlanilla', fontName=FONTS['body'][0], fontSize=9.5, textColor=GRIS_TEXTO, leading=12,
    )
    return [
        Paragraph(_escape(etiqueta.upper()), estilo_etiqueta),
        Paragraph(_escape(valor or '—'), estilo_valor),
    ]


def _grid(pares: list[tuple[str, str]], ancho: float) -> Table:
    filas = []
    for i in range(0, len(pares), 2):
        izquierda = _par(*pares[i])
        derecha = _par(*pares[i + 1]) if i + 1 < len(pares) else ''
        filas.append([izquierda, derecha])
    tabla = Table(filas, colWidths=[ancho / 2, ancho / 2])
    tabla.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, GRIS_BORDE),
    ]))
    return tabla


def _tabla_listado(columnas: list[str], filas: list[list[str]], anchos: list[float]) -> Table:
    estilo_cabecera = ParagraphStyle(
        'CabeceraListadoPlanilla', fontName=FONTS['header_cell'][0], fontSize=7.5,
        textColor=BLANCO, alignment=TA_CENTER, leading=9,
    )
    estilo_celda = ParagraphStyle(
        'CeldaListadoPlanilla', fontName=FONTS['body'][0], fontSize=8.5, textColor=GRIS_TEXTO, leading=11,
    )
    cabecera = [Paragraph(_escape(c), estilo_cabecera) for c in columnas]
    cuerpo = [
        [Paragraph(_escape(valor or '—'), estilo_celda) for valor in fila]
        for fila in filas
    ]
    tabla = Table([cabecera, *cuerpo], colWidths=anchos, repeatRows=1)
    estilo = [
        ('BACKGROUND', (0, 0), (-1, 0), AZUL_CONATEL),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, GRIS_BORDE),
    ]
    for indice in range(1, len(cuerpo) + 1):
        if indice % 2 == 0:
            estilo.append(('BACKGROUND', (0, indice), (-1, indice), GRIS_FONDO))
    tabla.setStyle(TableStyle(estilo))
    return tabla


def _chips(datos: dict) -> Table:
    persona = datos.get('persona') or {}
    solicitud = datos.get('solicitud') or {}
    proceso = datos.get('proceso') or {}
    constancia = datos.get('constancia') or {}
    elementos = [
        (_texto(datos.get('tipo_pasivo')) or 'Sin tipo', AZUL_CONATEL, BLANCO),
        ('Presencial' if solicitud.get('canal') == 'PRESENCIAL' else 'En línea', GRIS_FONDO, GRIS_TEXTO),
        (f"Aprobada {_fecha_civil((solicitud.get('fecha_validacion') or '')[:10])}", AZUL_CLARO, AZUL_CONATEL),
    ]
    if _texto(constancia.get('numero')):
        elementos.append((f"Constancia {constancia['numero']}", AMARILLO_SUAVE, AMARILLO_ACENTO))
    estilo = ParagraphStyle(
        'ChipPlanilla', fontName=FONTS['header_cell'][0], fontSize=7.5, alignment=TA_CENTER, leading=9,
    )
    celdas = []
    for texto, _fondo, color in elementos:
        celdas.append(Paragraph(_escape(texto), ParagraphStyle(
            'ChipPlanillaColor', parent=estilo, textColor=color,
        )))
    chips = Table([celdas], colWidths=None)
    chips.setStyle(TableStyle([
        *[('BACKGROUND', (i, 0), (i, 0), fondo) for i, (_t, fondo, _c) in enumerate(elementos)],
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return chips


def _tarjeta(datos: dict, foto, ancho: float) -> Table:
    persona = datos.get('persona') or {}
    proceso = datos.get('proceso') or {}
    nombre = f"{_texto(persona.get('nombres'))} {_texto(persona.get('apellidos'))}".strip()
    estilo_nombre = ParagraphStyle(
        'NombrePlanilla', fontName=FONTS['title'][0], fontSize=18, textColor=AZUL_OSCURO, leading=21,
    )
    estilo_detalle = ParagraphStyle(
        'DetallePlanilla', fontName=FONTS['body'][0], fontSize=9.5, textColor=GRIS_TEXTO, leading=12,
    )
    izquierda = [
        Paragraph(_escape(nombre or 'Sin nombre'), estilo_nombre),
        Spacer(1, 1.5 * mm),
        Paragraph(
            f"C.I. N.° {_escape(_texto(persona.get('cedula')))} · {_escape(_texto(datos.get('tipo_pasivo')))}",
            estilo_detalle,
        ),
        Paragraph(f"Proceso: {_escape(_texto(proceso.get('nombre')))}", estilo_detalle),
        Spacer(1, 3 * mm),
        _chips(datos),
    ]
    if foto is not None:
        contenido = Table([[izquierda, foto]], colWidths=[ancho - 52 * mm, 52 * mm])
    else:
        contenido = Table([[izquierda]], colWidths=[ancho])
    contenido.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), AZUL_CLARO),
        ('LINEBEFORE', (0, 0), (0, 0), 3.5, AZUL_CONATEL),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    return contenido


def _nota_sin_foto(ancho: float) -> Paragraph:
    estilo = ParagraphStyle(
        'NotaSinFotoPlanilla', fontName=FONTS['small'][0], fontSize=7.5, textColor=GRIS_MUTED,
        leading=10, spaceBefore=3, spaceAfter=3,
    )
    return Paragraph(f'<i>{_escape(NOTA_SIN_FOTO)}</i>', estilo)


def generar_planilla_pdf(datos: dict, *, generado_en: datetime | None = None) -> bytes:
    """PDF de una ficha aprobada. `datos` es la instantánea guardada en la constancia."""
    generado_en = generado_en or timezone.localtime()
    pagina = PAGE_CONFIG['portrait']
    ancho = pagina['pagesize'][0] - pagina['leftMargin'] - pagina['rightMargin']

    persona = datos.get('persona') or {}
    vivienda = datos.get('vivienda') or {}
    complementarios = datos.get('complementarios') or {}
    proceso = datos.get('proceso') or {}
    buffer_foto, relacion = _cargar_foto(datos)
    foto_vertical = _imagen(buffer_foto, ANCHO_FOTO_VERTICAL, ALTO_FOTO_VERTICAL) if buffer_foto and (relacion or 0) <= 1.2 else None
    foto_horizontal = _imagen(buffer_foto, ANCHO_FOTO_HORIZONTAL, ALTO_FOTO_HORIZONTAL) if buffer_foto and (relacion or 0) > 1.2 else None
    foto_ausente = buffer_foto is None

    historia = [
        _tarjeta(datos, foto_vertical if not foto_ausente else _placeholder(ANCHO_FOTO_VERTICAL, ALTO_FOTO_VERTICAL), ancho),
        Spacer(1, 3 * mm),
    ]
    if foto_ausente:
        historia.append(_nota_sin_foto(ancho))
    if foto_horizontal is not None:
        historia += [
            _titulo_seccion('Evidencia fotográfica', ancho),
            Spacer(1, 2 * mm),
            Table([[foto_horizontal]], colWidths=[ancho], style=TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ])),
            Spacer(1, 2 * mm),
        ]

    historia += [
        _titulo_seccion('Datos personales', ancho),
        Spacer(1, 2 * mm),
        _grid([
            ('Cédula', _texto(persona.get('cedula'))),
            ('Sexo', _texto(persona.get('sexo'))),
            ('Nombres', _texto(persona.get('nombres'))),
            ('Apellidos', _texto(persona.get('apellidos'))),
            ('Fecha de nacimiento', _fecha_civil(persona.get('fecha_nacimiento'))),
            ('¿Tiene hijos?', 'Sí' if complementarios.get('tiene_hijos') is True else 'No' if complementarios.get('tiene_hijos') is False else '—'),
        ], ancho),
        Spacer(1, 2 * mm),
        _titulo_seccion('Contacto', ancho),
        Spacer(1, 2 * mm),
        _grid([
            ('Correo principal', _texto(persona.get('correo'))),
            ('Teléfono móvil', _texto(persona.get('telefono_movil'))),
            ('Teléfono de habitación', _texto(persona.get('telefono_habitacion'))),
            ('Correo alternativo', _texto(complementarios.get('correo_alternativo'))),
        ], ancho),
        Spacer(1, 2 * mm),
    ]

    vivienda_pares = [('País', _texto(vivienda.get('pais')))]
    if vivienda.get('es_venezuela', True):
        vivienda_pares += [
            ('Estado', _texto(vivienda.get('estado'))),
            ('Municipio', _texto(vivienda.get('municipio'))),
            ('Parroquia', _texto(vivienda.get('parroquia'))),
            ('Código postal', _texto(vivienda.get('codigo_postal'))),
        ]
    else:
        vivienda_pares.append(('Ciudad o región', _texto(vivienda.get('ciudad_region'))))
    vivienda_pares += [
        ('Dirección', _texto(vivienda.get('direccion'))),
        ('Condición de la vivienda', _texto(vivienda.get('condicion'))),
    ]
    if any(valor for _etiqueta, valor in vivienda_pares):
        historia += [
            _titulo_seccion('Vivienda', ancho),
            Spacer(1, 2 * mm),
            _grid(vivienda_pares, ancho),
            Spacer(1, 2 * mm),
        ]

    familiares = datos.get('familiares') or []
    if familiares:
        historia += [
            _titulo_seccion('Grupo familiar', ancho),
            Spacer(1, 2 * mm),
            _tabla_listado(
                ['Nombre', 'Cédula', 'Parentesco', 'Fecha de nacimiento', 'Sexo'],
                [
                    [
                        _texto(f.get('nombres')), _texto(f.get('cedula')), _texto(f.get('parentesco')),
                        _fecha_civil(f.get('fecha_nacimiento')), _texto(f.get('sexo')),
                    ]
                    for f in familiares
                ],
                [ancho * 0.34, ancho * 0.18, ancho * 0.20, ancho * 0.16, ancho * 0.12],
            ),
            Spacer(1, 2 * mm),
        ]

    contactos = datos.get('contactos') or []
    if contactos:
        historia += [
            _titulo_seccion('Contactos de emergencia', ancho),
            Spacer(1, 2 * mm),
            _tabla_listado(
                ['Nombre', 'Parentesco', 'Teléfono'],
                [[_texto(c.get('nombres')), _texto(c.get('parentesco')), _texto(c.get('telefono'))] for c in contactos],
                [ancho * 0.50, ancho * 0.25, ancho * 0.25],
            ),
            Spacer(1, 2 * mm),
        ]

    texto_pie = f"Proceso: {_texto(proceso.get('nombre')) or '—'} · Generado: {generado_en:%d/%m/%Y %H:%M}"
    return construir_pdf(
        TITULO, historia, config=construir_config_pdf(), generado_en=generado_en,
        orientation='portrait', texto_pie=texto_pie,
    )
