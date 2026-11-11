"""Siembra el parámetro `carnetizacion.qr_tamano_minimo_mm` (QR legible por SILOG)."""
from django.db import migrations

CLAVE = 'carnetizacion.qr_tamano_minimo_mm'


def sembrar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    ParametroSistema.objects.get_or_create(
        clave=CLAVE,
        defaults={
            'etiqueta': 'Tamaño mínimo del QR legible (mm)',
            'descripcion': (
                'Al publicar una plantilla de carnet, al menos un código QR debe medir como mínimo '
                'este tamaño (ancho y alto, en mm) para que pueda leerse con un teléfono (SILOG).'
            ),
            'grupo': 'carnetizacion',
            'tipo': 'entero',
            'valor': '20',
            'valor_min': 10,
            'valor_max': 60,
        },
    )


def retirar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    ParametroSistema.objects.filter(clave=CLAVE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0010_sembrar_reglas_parentesco'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
