"""Planilla de fe de vida en PDF (una por solicitud VALIDADA).

Se genera desde la instantánea aprobada (`ConstanciaFeDeVida.datos_planilla`), no desde el expediente
actual. Incluye la foto de la solicitud; si ya no está en el almacén, se dibuja un recuadro
«Foto no disponible» y se explica la causa probable.
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
from core.infrastructure.pdf.pdf_styles import COLORS, FONTS, get_paragraph_styles
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

TITULO = 'Planilla de fe de vida'
ANCHO_FOTO = 42 * mm
ALTO_FOTO = 52 * mm
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


def _foto(datos: dict) -> tuple[object, bool]:
    """Imagen normalizada o recuadro «Foto no disponible», y si la foto se pudo cargar."""
    clave = _texto((datos.get('foto') or {}).get('clave'))
    if clave:
        try:
            contenido = SeaweedFSStorage().descargar(clave)
            with Imagen.open(BytesIO(contenido)) as original:
                imagen = ImageOps.exif_transpose(original).convert('RGB')
                imagen.thumbnail((1200, 1200))
                salida = BytesIO()
                imagen.save(salida, format='JPEG', quality=85, optimize=True)
                ancho, alto = imagen.size
            salida.seek(0)
            escala = min(ANCHO_FOTO / ancho, ALTO_FOTO / alto)
            return Image(salida, width=ancho * escala, height=alto * escala), True
        except Exception:  # noqa: BLE001 - la planilla debe salir aunque el almacén falle
            pass
    estilo = ParagraphStyle(
        'FotoNoDisponible', fontName=FONTS['small'][0], fontSize=FONTS['small'][1],
        textColor=COLORS['muted'], alignment=TA_CENTER, leading=11,
    )
    caja = Table([[Paragraph('Foto no disponible', estilo)]], colWidths=[ANCHO_FOTO], rowHeights=[ALTO_FOTO])
    caja.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.6, COLORS['border']),
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['row_alt']),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    return caja, False


def _tabla_datos(filas: list[tuple[str, str]], ancho: float) -> Table:
    celda = get_paragraph_styles()['TableCell']
    cuerpo = [
        [Paragraph(f'<b>{_escape(etiqueta)}</b>', celda), Paragraph(_escape(valor or '—'), celda)]
        for etiqueta, valor in filas
    ]
    tabla = Table(cuerpo, colWidths=[ancho * 0.30, ancho * 0.70])
    tabla.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.4, COLORS['border']),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (0, -1), COLORS['row_alt']),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return tabla


def _tabla_multicolumna(columnas: list[str], filas: list[list[str]], anchos: list[float]) -> Table:
    estilos = get_paragraph_styles()
    cabecera = [Paragraph(f'<b>{_escape(c)}</b>', estilos['TableHeader']) for c in columnas]
    cuerpo = [
        [Paragraph(_escape(celda or '—'), estilos['TableCell']) for celda in fila]
        for fila in filas
    ]
    tabla = Table([cabecera, *cuerpo], colWidths=anchos, repeatRows=1)
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLORS['header_bg']),
        ('GRID', (0, 0), (-1, -1), 0.4, COLORS['border']),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return tabla


def _seccion(titulo: str, contenido, ancho: float, estilos) -> KeepTogether:
    titulo_parrafo = Paragraph(
        f'<b>{_escape(titulo)}</b>',
        ParagraphStyle(
            'SeccionPlanilla', fontName=FONTS['header_cell'][0], fontSize=10.5,
            textColor=COLORS['text'], spaceBefore=2, spaceAfter=3,
        ),
    )
    return KeepTogether([titulo_parrafo, contenido, Spacer(1, 4 * mm)])


def _cabecera(datos: dict, ancho: float, estilos, foto_elemento) -> Table:
    persona = datos.get('persona') or {}
    solicitud = datos.get('solicitud') or {}
    proceso = datos.get('proceso') or {}
    constancia = datos.get('constancia') or {}
    filas = [
        ('Nombre completo', f"{_texto(persona.get('nombres'))} {_texto(persona.get('apellidos'))}".strip()),
        ('Cédula', _texto(persona.get('cedula'))),
        ('Tipo de pasivo', _texto(datos.get('tipo_pasivo'))),
        ('Proceso', _texto(proceso.get('nombre'))),
        ('Estado', _texto(proceso.get('estado')).title()),
        ('Fecha de aprobación', _fecha_hora(solicitud.get('fecha_validacion'))),
        ('Constancia N.°', _texto(constancia.get('numero')) or 'No disponible'),
        ('Canal', 'Presencial' if solicitud.get('canal') == 'PRESENCIAL' else 'En línea'),
        ('Fecha de envío', _fecha_hora(solicitud.get('fecha_envio'))),
    ]
    izquierda = _tabla_datos(filas, ancho - ANCHO_FOTO - 6 * mm)
    contenedor = Table([[izquierda, foto_elemento]], colWidths=[ancho - ANCHO_FOTO - 6 * mm, ANCHO_FOTO + 6 * mm])
    contenedor.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    return contenedor


def generar_planilla_pdf(datos: dict, *, generado_en: datetime | None = None) -> bytes:
    """PDF de una ficha aprobada. `datos` es la instantánea guardada en la constancia."""
    generado_en = generado_en or timezone.localtime()
    estilos = get_paragraph_styles()
    # El ancho útil depende de los márgenes de la plantilla A4 vertical (PAGE_CONFIG['portrait']).
    from core.infrastructure.pdf.pdf_styles import PAGE_CONFIG
    pagina = PAGE_CONFIG['portrait']
    ancho = pagina['pagesize'][0] - pagina['leftMargin'] - pagina['rightMargin']

    persona = datos.get('persona') or {}
    vivienda = datos.get('vivienda') or {}
    complementarios = datos.get('complementarios') or {}
    proceso = datos.get('proceso') or {}
    foto_elemento, foto_disponible = _foto(datos)

    historia = [
        _cabecera(datos, ancho, estilos, foto_elemento),
        Spacer(1, 5 * mm),
    ]
    if not foto_disponible:
        historia.append(Paragraph(
            f'<i>{_escape(NOTA_SIN_FOTO)}</i>',
            ParagraphStyle(
                'NotaSinFoto', fontName=FONTS['small'][0], fontSize=FONTS['small'][1],
                textColor=COLORS['muted'], leading=11, spaceAfter=4 * mm,
            ),
        ))

    historia.append(_seccion('Datos personales', _tabla_datos([
        ('Cédula', _texto(persona.get('cedula'))),
        ('Nombres', _texto(persona.get('nombres'))),
        ('Apellidos', _texto(persona.get('apellidos'))),
        ('Sexo', _texto(persona.get('sexo'))),
        ('Fecha de nacimiento', _fecha_civil(persona.get('fecha_nacimiento'))),
    ], ancho), ancho, estilos))

    historia.append(_seccion('Contacto', _tabla_datos([
        ('Correo principal', _texto(persona.get('correo'))),
        ('Teléfono móvil', _texto(persona.get('telefono_movil'))),
        ('Teléfono de habitación', _texto(persona.get('telefono_habitacion'))),
        ('Correo alternativo', _texto(complementarios.get('correo_alternativo'))),
    ], ancho), ancho, estilos))

    vivienda_filas = [('País', _texto(vivienda.get('pais')))]
    if vivienda.get('es_venezuela', True):
        vivienda_filas += [
            ('Estado', _texto(vivienda.get('estado'))),
            ('Municipio', _texto(vivienda.get('municipio'))),
            ('Parroquia', _texto(vivienda.get('parroquia'))),
            ('Código postal', _texto(vivienda.get('codigo_postal'))),
        ]
    else:
        vivienda_filas.append(('Ciudad o región', _texto(vivienda.get('ciudad_region'))))
    vivienda_filas += [
        ('Dirección', _texto(vivienda.get('direccion'))),
        ('Condición de la vivienda', _texto(vivienda.get('condicion'))),
    ]
    if any(valor for _etiqueta, valor in vivienda_filas):
        historia.append(_seccion('Vivienda', _tabla_datos(vivienda_filas, ancho), ancho, estilos))

    familiares = datos.get('familiares') or []
    if familiares:
        historia.append(_seccion(
            'Grupo familiar',
            _tabla_multicolumna(
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
            ancho, estilos,
        ))

    contactos = datos.get('contactos') or []
    if contactos:
        historia.append(_seccion(
            'Contactos de emergencia',
            _tabla_multicolumna(
                ['Nombre', 'Parentesco', 'Teléfono'],
                [[_texto(c.get('nombres')), _texto(c.get('parentesco')), _texto(c.get('telefono'))] for c in contactos],
                [ancho * 0.50, ancho * 0.25, ancho * 0.25],
            ),
            ancho, estilos,
        ))

    historia.append(_seccion('Datos complementarios', _tabla_datos([
        ('¿Tiene hijos?', 'Sí' if complementarios.get('tiene_hijos') is True else 'No' if complementarios.get('tiene_hijos') is False else '—'),
        ('Correo alternativo', _texto(complementarios.get('correo_alternativo'))),
    ], ancho), ancho, estilos))

    texto_pie = f"Proceso: {_texto(proceso.get('nombre')) or '—'} · Generado: {generado_en:%d/%m/%Y %H:%M}"
    return construir_pdf(
        TITULO, historia, config=construir_config_pdf(), generado_en=generado_en,
        orientation='portrait', texto_pie=texto_pie,
    )
