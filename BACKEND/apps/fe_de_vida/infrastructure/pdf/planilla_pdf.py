"""Planilla de fe de vida en PDF (una por solicitud VALIDADA).

Misma maquetación que el «Expediente del trabajador» (`expediente_estilos`): tarjeta de identificación,
títulos de sección, grillas etiqueta/valor y tablas institucionales. Se alimenta de la instantánea
aprobada (`ConstanciaFeDeVida.datos_planilla`), no del expediente actual.
"""
from datetime import date, datetime
from io import BytesIO

from django.utils import timezone
from PIL import Image as Imagen, ImageOps
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, Spacer, Table, TableStyle

from apps.configuracion.infrastructure.pdf_config import construir_config_pdf
from apps.fe_de_vida.infrastructure.pdf.comun import construir_pdf
from core.infrastructure.pdf.expediente_estilos import (
    grilla,
    nota_gris,
    tabla,
    tarjeta_identificacion,
    titulo_seccion,
)
from core.infrastructure.pdf.paleta import GRIS_BORDE, GRIS_FONDO, GRIS_MUTED
from core.infrastructure.pdf.pdf_styles import FONTS, PAGE_CONFIG
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

TITULO = 'Planilla de fe de vida'
ANCHO_FOTO_TARJETA = 30 * mm
ALTO_FOTO_TARJETA = 35 * mm
ANCHO_FOTO_BANDA = 110 * mm
ALTO_FOTO_BANDA = 85 * mm
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
    foto = Image(buffer, width=ancho * escala, height=alto * escala)
    foto.hAlign = 'CENTER'
    return foto


def _placeholder(ancho: float, alto: float) -> Table:
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph
    from reportlab.lib.enums import TA_CENTER

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


def _lineas_tarjeta(datos: dict) -> list[str]:
    persona = datos.get('persona') or {}
    solicitud = datos.get('solicitud') or {}
    proceso = datos.get('proceso') or {}
    constancia = datos.get('constancia') or {}
    lineas = [
        f"C.I. N.° {_texto(persona.get('cedula'))} · {_texto(datos.get('tipo_pasivo'))}",
        f"Proceso: {_texto(proceso.get('nombre'))}",
    ]
    aprobacion = f"Aprobada el {_fecha_civil((solicitud.get('fecha_validacion') or '')[:10])}"
    if _texto(constancia.get('numero')):
        aprobacion += f" · Constancia N.° {constancia['numero']}"
    lineas.append(aprobacion)
    canal = 'Presencial' if solicitud.get('canal') == 'PRESENCIAL' else 'En línea'
    lineas.append(f"Canal: {canal} · Enviada el {_fecha_hora(solicitud.get('fecha_envio'))}")
    return lineas


def _seccion(titulo: str, cuerpo, ancho: float) -> list:
    """Título + contenido juntos, con el espaciado compacto de la planilla."""
    bloques = cuerpo if isinstance(cuerpo, list) else [cuerpo]
    return [Spacer(1, 8), KeepTogether([titulo_seccion(titulo, ancho), Spacer(1, 4), *bloques])]


def _seccion_tabla(titulo: str, cuerpo, ancho: float) -> list:
    """Título + tabla siempre juntos; si la tabla no cabe, se parte con su encabezado."""
    return [Spacer(1, 8), KeepTogether([titulo_seccion(titulo, ancho), Spacer(1, 4), cuerpo])]


def _pares_vivienda(vivienda: dict) -> list[tuple[str, str]]:
    pares = [('País', _texto(vivienda.get('pais')))]
    if vivienda.get('es_venezuela', True):
        pares += [
            ('Estado', _texto(vivienda.get('estado'))),
            ('Municipio', _texto(vivienda.get('municipio'))),
            ('Parroquia', _texto(vivienda.get('parroquia'))),
            ('Código postal', _texto(vivienda.get('codigo_postal'))),
        ]
    else:
        pares.append(('Ciudad o región', _texto(vivienda.get('ciudad_region'))))
    pares += [
        ('Dirección', _texto(vivienda.get('direccion'))),
        ('Condición de la vivienda', _texto(vivienda.get('condicion'))),
    ]
    return pares


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
    foto_vertical = (
        _imagen(buffer_foto, ANCHO_FOTO_TARJETA, ALTO_FOTO_TARJETA)
        if buffer_foto and (relacion or 0) <= 1.2 else None
    )
    foto_banda = (
        _imagen(buffer_foto, ANCHO_FOTO_BANDA, ALTO_FOTO_BANDA)
        if buffer_foto and (relacion or 0) > 1.2 else None
    )
    foto_ausente = buffer_foto is None

    nombre = f"{_texto(persona.get('nombres'))} {_texto(persona.get('apellidos'))}".strip()
    historia = [
        tarjeta_identificacion(nombre or 'Sin nombre', _lineas_tarjeta(datos), ancho, foto_vertical),
    ]

    if foto_banda is not None:
        historia += _seccion('Evidencia fotográfica', [foto_banda], ancho)
    elif foto_ausente:
        historia += _seccion(
            'Evidencia fotográfica',
            [_placeholder(ANCHO_FOTO_BANDA, 35 * mm), nota_gris(NOTA_SIN_FOTO)],
            ancho,
        )

    historia += _seccion('Datos personales', grilla([
        ('Cédula', _texto(persona.get('cedula'))),
        ('Sexo', _texto(persona.get('sexo'))),
        ('Nombres', _texto(persona.get('nombres'))),
        ('Apellidos', _texto(persona.get('apellidos'))),
        ('Fecha de nacimiento', _fecha_civil(persona.get('fecha_nacimiento'))),
        ('¿Tiene hijos?', 'Sí' if complementarios.get('tiene_hijos') is True else 'No' if complementarios.get('tiene_hijos') is False else '—'),
    ], ancho), ancho)

    historia += _seccion('Contacto', grilla([
        ('Correo principal', _texto(persona.get('correo'))),
        ('Teléfono móvil', _texto(persona.get('telefono_movil'))),
        ('Teléfono de habitación', _texto(persona.get('telefono_habitacion'))),
        ('Correo alternativo', _texto(complementarios.get('correo_alternativo'))),
    ], ancho), ancho)

    pares_vivienda = _pares_vivienda(vivienda)
    if any(valor for _etiqueta, valor in pares_vivienda):
        historia += _seccion('Vivienda', grilla(pares_vivienda, ancho), ancho)

    familiares = datos.get('familiares') or []
    if familiares:
        historia += _seccion_tabla('Grupo familiar', tabla(
            ['Nombre', 'Cédula', 'Parentesco', 'Fecha de nacimiento', 'Sexo'],
            [
                [
                    _texto(f.get('nombres')), _texto(f.get('cedula')), _texto(f.get('parentesco')),
                    _fecha_civil(f.get('fecha_nacimiento')), _texto(f.get('sexo')),
                ]
                for f in familiares
            ],
            [34, 18, 20, 16, 12], ancho,
        ), ancho)

    contactos = datos.get('contactos') or []
    if contactos:
        historia += _seccion_tabla('Contactos de emergencia', tabla(
            ['Nombre', 'Parentesco', 'Teléfono'],
            [[_texto(c.get('nombres')), _texto(c.get('parentesco')), _texto(c.get('telefono'))] for c in contactos],
            [50, 25, 25], ancho,
        ), ancho)

    texto_pie = f"Proceso: {_texto(proceso.get('nombre')) or '—'} · Generado: {generado_en:%d/%m/%Y %H:%M}"
    return construir_pdf(
        TITULO, historia, config=construir_config_pdf(), generado_en=generado_en,
        orientation='portrait', texto_pie=texto_pie,
    )
