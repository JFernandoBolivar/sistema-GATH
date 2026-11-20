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

from django.db import migrations

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


def _imagen_heredada_data_url(apps):
    """Data URL de la imagen activa de CarnetTemplate, si la tabla y el archivo existen."""
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
    from apps.carnetizacion.domain.services.plantilla_defecto import (
        NOMBRE_PLANTILLA_LEGACY,
        plantilla_defecto_heredada,
    )

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

    definicion = plantilla_defecto_heredada(_imagen_heredada_data_url(apps))
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
