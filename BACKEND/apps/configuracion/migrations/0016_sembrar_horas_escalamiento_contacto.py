"""Siembra `captacion.horas_escalamiento_contacto` (G-1): horas tras las que el contacto con el postulante se escala.

Idempotente (no pisa un valor ya editado) y reversible (al retroceder borra solo esta clave).
"""
from django.db import migrations

PARAMETROS = (
    (
        'captacion.horas_escalamiento_contacto',
        'Horas para escalar el contacto con el postulante',
        'Horas que Captación tiene para contactar al postulante tras reabrir su ventana '
        '(Ventana 2 o faltantes). Pasado ese plazo sin contactarlo, la tarea queda atrasada: '
        'sube al inicio de la bandeja y se avisa de nuevo.',
        'entero', '48', 1, 720,
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
        ('configuracion', '0015_sembrar_espera_diferido'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
