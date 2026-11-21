"""Siembra `captacion.espera_diferido_dias` (C-10): plazo tras el cual un expediente diferido se desiste.

Idempotente (no pisa un valor ya editado) y reversible (al retroceder borra solo esta clave).
"""
from django.db import migrations

PARAMETROS = (
    (
        'captacion.espera_diferido_dias',
        'Espera máxima de un expediente diferido (días)',
        'Días que un expediente diferido por Presupuesto espera a que se libere la partida, '
        'contados desde que se difiere. Al vencer, el sistema lo da por desistido.',
        'entero', '90', 1, 365,
    ),
)


def sembrar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    for clave, etiqueta, descripcion, tipo, valor, minimo, maximo in PARAMETROS:
        ParametroSistema.objects.get_or_create(
            clave=clave,
            defaults={
                'etiqueta': etiqueta,
                'descripcion': descripcion,
                'grupo': 'captacion',
                'tipo': tipo,
                'valor': valor,
                'valor_min': minimo,
                'valor_max': maximo,
            },
        )


def retirar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    ParametroSistema.objects.filter(clave__in=[p[0] for p in PARAMETROS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0014_sembrar_parametros_captacion'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
