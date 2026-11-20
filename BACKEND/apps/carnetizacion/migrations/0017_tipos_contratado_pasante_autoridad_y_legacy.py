"""B-7: nuevos tipos de credencial y siembra de la maqueta heredada como v1 LEGACY.

Los tipos contratado, pasante y autoridad son credenciales internas (grupo
``trabajador``): comparten la plantilla institucional y no deben aparecer como
credenciales externas.

La maqueta heredada se traslada desde la tabla ``CarnetTemplate`` a una plantilla
real del motor con estado ``LEGACY`` y versión 1. La imagen de fondo se incrusta
como data URL en la definición cuando el archivo está disponible; así la
reimpresión no depende de una ruta de ``MEDIA_ROOT`` ni de la tabla heredada. Si
no hay imagen (instalación nueva o archivo perdido), se siembra un fondo
vectorial de respaldo sin datos personales. La siembra es idempotente.
"""
import base64
import logging
from typing import Any

from django.db import migrations

logger = logging.getLogger('gath.carnetizacion')

# --- Diseño heredado CONGELADO (K-2) -------------------------------------------------------
# Copia de `domain/services/plantilla_defecto.py` al momento de escribir esta migración. Una
# migración no debe importar código vivo de la app: si ese código cambiara, la migración
# sembraría otra cosa (o fallaría) en las bases nuevas.
NOMBRE_PLANTILLA_LEGACY = 'Plantilla heredada (LEGACY)'

# Constantes de la maqueta heredada: el PDF antiguo dibujaba la foto, el QR y los
# datos personales con estas medidas sobre una imagen de fondo a sangre.
_LEGACY_ANCHO_MM = 54.0
_LEGACY_ALTO_MM = 85.6
_LEGACY_FUENTE_PT = 7.0
_MM_A_PT = 72.0 / 25.4


def _y_caja_texto_legacy(y_base_mm: float, alto_caja_mm: float = 3.0) -> float:
    """Coordenada superior de una caja cuyo texto queda en la línea base heredada.

    El motor centra una línea con `y_pt + (h_pt - fuente) / 2 + 0.5`; se despeja
    la `y` para que la línea base coincida con la que usaba el renderizador fijo.
    """
    desplazamiento_mm = (
        (alto_caja_mm / 2)
        + (_LEGACY_FUENTE_PT / 2 - 0.5) / _MM_A_PT
    )
    return round(_LEGACY_ALTO_MM - y_base_mm - desplazamiento_mm, 4)


def _elementos_fondo_legacy_vectorial() -> list[dict[str, Any]]:
    """Fondo de respaldo cuando la instalación no conserva la imagen heredada.

    Reproduce los rasgos estables de la maqueta (marco institucional, cintillos y
    pie) sin datos personales. Si la migración encuentra la imagen original, esta
    se incrusta y este respaldo no se usa.
    """
    return [
        {'id': 'legacy-marco', 'tipo': 'rect', 'nombre': 'Marco institucional', 'x': 0, 'y': 0, 'w': 54, 'h': 85.6, 'props': {'fill': '#ffffff', 'stroke': '#0033a0', 'sw': 1.2}},
        {'id': 'legacy-marco-int', 'tipo': 'rect', 'nombre': 'Marco interior', 'x': 1.2, 'y': 1.2, 'w': 51.6, 'h': 83.2, 'props': {'fill': '#ffffff', 'stroke': '#ffd100', 'sw': 0.8}},
        {'id': 'legacy-cinta-roja', 'tipo': 'rect', 'nombre': 'Cinta roja superior', 'x': 0, 'y': 0, 'w': 54, 'h': 2.2, 'props': {'fill': '#d9121f'}},
        {'id': 'legacy-cinta-azul', 'tipo': 'rect', 'nombre': 'Cinta azul superior', 'x': 0, 'y': 2.2, 'w': 54, 'h': 11.8, 'props': {'fill': '#0033a0'}},
        {'id': 'legacy-cinta-amarilla', 'tipo': 'rect', 'nombre': 'Cinta amarilla', 'x': 0, 'y': 14, 'w': 54, 'h': 0.8, 'props': {'fill': '#ffd100'}},
        {'id': 'legacy-logo', 'tipo': 'image', 'nombre': 'Logo institucional', 'x': 4, 'y': 4.2, 'w': 25, 'h': 7, 'props': {'label': 'LOGO', 'asset': 'logo01.png'}},
        {'id': 'legacy-pie', 'tipo': 'rect', 'nombre': 'Pie institucional', 'x': 0, 'y': 78, 'w': 54, 'h': 7.6, 'props': {'fill': '#f3f4f6'}},
        {'id': 'legacy-pie-rojo', 'tipo': 'rect', 'nombre': 'Acento del pie', 'x': 3, 'y': 80, 'w': 1.2, 'h': 3.6, 'props': {'fill': '#d9121f'}},
        {'id': 'legacy-pie-texto', 'tipo': 'text', 'nombre': 'Pie institucional', 'texto': 'GOBIERNO BOLIVARIANO DE VENEZUELA\nMin. del Poder Popular para la Comunicación y la Información', 'x': 6, 'y': 79.5, 'w': 44, 'h': 5.5, 'fontSize': 3.4, 'bold': True, 'color': '#111827'},
    ]


def plantilla_defecto_heredada(imagen_data_url: str | None = None) -> dict[str, Any]:
    """Maqueta heredada (v1 · LEGACY): imagen de fondo y capas variables encima.

    Conserva el comportamiento del PDF fijo anterior: una sola cara, fondo a sangre,
    QR de 12 mm abajo a la izquierda, foto de 20 × 24 mm centrada, nombre y cédula
    debajo. `imagen_data_url` permite incrustar la imagen que tenía `CarnetTemplate`
    sin depender del almacén de medios ni de una ruta local.
    """
    fondo: list[dict[str, Any]] = []
    if imagen_data_url:
        fondo.append({
            'id': 'legacy-fondo',
            'tipo': 'image',
            'nombre': 'Fondo heredado',
            'x': 0,
            'y': 0,
            'w': _LEGACY_ANCHO_MM,
            'h': _LEGACY_ALTO_MM,
            'props': {'data': imagen_data_url, 'preserveAspectRatio': False},
        })
    else:
        fondo.extend(_elementos_fondo_legacy_vectorial())

    anverso = fondo + [
        {'id': 'legacy-foto', 'tipo': 'photo', 'nombre': 'Foto del titular', 'x': 17, 'y': 15.6, 'w': 20, 'h': 24, 'props': {'fill': '#e5e7eb'}},
        {'id': 'legacy-qr', 'tipo': 'qr', 'nombre': 'Código QR seguro', 'x': 4, 'y': 65.6, 'w': 12, 'h': 12, 'props': {'fill': '#111827'}},
        {'id': 'legacy-nombre', 'tipo': 'field', 'campo': 'nombre_completo', 'nombre': 'Nombre completo', 'x': 0.8, 'y': _y_caja_texto_legacy(43.0), 'w': 52.4, 'h': 3, 'fontSize': 7, 'bold': True, 'align': 'center', 'upper': True, 'color': '#000000'},
        {'id': 'legacy-cedula', 'tipo': 'field', 'campo': 'cedula', 'nombre': 'Cédula de identidad', 'x': 0.8, 'y': _y_caja_texto_legacy(38.5), 'w': 52.4, 'h': 3, 'fontSize': 7, 'bold': False, 'align': 'center', 'prefijo': 'C.I: ', 'color': '#000000'},
    ]

    return {
        'origen': 'CarnetTemplate',
        'legacy': True,
        'caras': ['anverso'],
        'orientacion': 'vertical',
        'dimensiones': {'ancho_mm': _LEGACY_ANCHO_MM, 'alto_mm': _LEGACY_ALTO_MM},
        'bg': {'anverso': '#ffffff', 'reverso': '#ffffff'},
        'reglas': {
            'criterio': 'legacy',
            'primario': '#0033a0',
            'acento': '#ffd100',
            'texto': '#000000',
            'respaldo': {'primario': '#0033a0', 'acento': '#ffd100', 'texto': '#000000'},
            'valores': {},
        },
        'anverso': anverso,
        'reverso': [],
    }
# -------------------------------------------------------------------------------------------

TIPOS_NUEVOS = (
    {
        'codigo': 'contratado',
        'nombre': 'Contratado',
        'descripcion': 'Credencial oficial para personal contratado por la institución',
        'grupo': 'trabajador',
        'orden': 3,
    },
    {
        'codigo': 'pasante',
        'nombre': 'Pasante',
        'descripcion': 'Credencial oficial para pasantes y personal en formación',
        'grupo': 'trabajador',
        'orden': 4,
    },
    {
        'codigo': 'autoridad',
        'nombre': 'Autoridad',
        'descripcion': 'Credencial oficial para autoridades y directivos de la institución',
        'grupo': 'trabajador',
        'orden': 5,
    },
)

_MIMES = {
    b'\x89PNG\r\n\x1a\n': 'image/png',
    b'\xff\xd8\xff': 'image/jpeg',
}


def _imagen_heredada_data_url(apps, schema_editor):
    """Data URL de la imagen activa de CarnetTemplate, si la tabla y el archivo existen."""
    # K-2: en una base nueva la tabla heredada no existe (es managed=False). Consultarla
    # dentro de la transacción de la migración la abortaría en PostgreSQL aunque se capture
    # la excepción, así que se comprueba antes de tocarla.
    if 'CarnetTemplate' not in schema_editor.connection.introspection.table_names():
        return None
    try:
        CarnetTemplate = apps.get_model('carnetizacion', 'CarnetTemplateModel')
        fila = (
            CarnetTemplate.objects.filter(activo=True).first()
            or CarnetTemplate.objects.order_by('-pk').first()
        )
        if fila is None or not fila.imagen:
            return None
        archivo = fila.imagen
        archivo.open('rb')
        datos = archivo.read()
        archivo.close()
    except Exception:
        # Instalación nueva (tabla no creada, managed=False), archivo perdido o
        # almacén no disponible: se usa el fondo vectorial de respaldo.
        return None
    if not datos or len(datos) > 8 * 1024 * 1024:
        return None
    mime = next((tipo for firma, tipo in _MIMES.items() if datos.startswith(firma)), None)
    if mime is None:
        return None
    return f'data:{mime};base64,{base64.b64encode(datos).decode("ascii")}'


def sembrar_tipos_y_legacy(apps, schema_editor):
    Tipo = apps.get_model('carnetizacion', 'TipoCredencialModel')
    Plantilla = apps.get_model('carnetizacion', 'PlantillaCarnetModel')

    for datos in TIPOS_NUEVOS:
        Tipo.objects.get_or_create(
            codigo=datos['codigo'],
            defaults={
                'nombre': datos['nombre'],
                'descripcion': datos['descripcion'],
                'ancho_mm': 54.00,
                'alto_mm': 85.60,
                'orientacion': 'vertical',
                'grupo': datos['grupo'],
                'activo': True,
                'orden': datos['orden'],
            },
        )

    tipo_trabajador = Tipo.objects.filter(codigo='trabajador').first()
    if tipo_trabajador is None:
        tipo_trabajador = Tipo.objects.create(
            codigo='trabajador',
            nombre='Trabajador Activo',
            descripcion='Credencial oficial para personal activo institucional',
            ancho_mm=54.00,
            alto_mm=85.60,
            orientacion='vertical',
            grupo='trabajador',
            activo=True,
            orden=1,
        )

    if Plantilla.objects.filter(estado='LEGACY').exists():
        return

    imagen = _imagen_heredada_data_url(apps, schema_editor)
    if imagen is None:
        # K-10: queda constancia de que la plantilla LEGACY no lleva la imagen real.
        logger.warning(
            'Plantilla LEGACY sembrada con el fondo vectorial de respaldo: no se encontró la '
            'imagen de CarnetTemplate. Verifique la reimpresión de carnets antiguos con '
            '`manage.py verificar_plantilla_legacy` antes de desplegar.'
        )
    definicion = plantilla_defecto_heredada(imagen)
    legacy = Plantilla.objects.create(
        nombre=NOMBRE_PLANTILLA_LEGACY,
        tipo_credencial_id=tipo_trabajador.codigo,
        ancho_mm=definicion['dimensiones']['ancho_mm'],
        alto_mm=definicion['dimensiones']['alto_mm'],
        orientacion=definicion['orientacion'],
        regla_criterio='legacy',
        regla_valor='*',
        estado='LEGACY',
        activa=False,
        version=1,
        definicion=definicion,
        descripcion=(
            'Maqueta heredada de CarnetTemplate: respaldo de los carnets emitidos antes '
            'del versionado. No se usa para emitir carnets nuevos.'
        ),
    )
    legacy.plantilla_raiz_id = legacy.pk
    legacy.save(update_fields=['plantilla_raiz'])


def revertir(apps, schema_editor):
    # No destructivo: la plantilla LEGACY puede ser el único respaldo de carnets antiguos.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0016_limpiar_biblioteca_sembrada_sin_archivo'),
    ]

    operations = [
        migrations.RunPython(sembrar_tipos_y_legacy, reverse_code=revertir),
    ]
