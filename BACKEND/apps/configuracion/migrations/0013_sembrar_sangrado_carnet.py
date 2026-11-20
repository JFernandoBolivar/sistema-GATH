"""Siembra el parámetro `carnetizacion.sangrado_mm` (PDF del carnet en formato imprenta, B-3)."""
from django.db import migrations

CLAVE = 'carnetizacion.sangrado_mm'


def sembrar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    ParametroSistema.objects.get_or_create(
        clave=CLAVE,
        defaults={
            'etiqueta': 'Sangrado del carnet en formato imprenta (mm)',
            'descripcion': (
                'Milímetros que el fondo y las franjas que tocan el borde se prolongan más allá del '
                'corte en el PDF «formato imprenta» (con marcas de corte), para que un corte '
                'ligeramente desplazado no deje un filo blanco. 0 = sin sangrado.'
            ),
            'grupo': 'carnetizacion',
            'tipo': 'entero',
            'valor': '2',
            'valor_min': 0,
            'valor_max': 5,
        },
    )


def retirar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    ParametroSistema.objects.filter(clave=CLAVE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0012_sembrar_vigencia_carnet'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
