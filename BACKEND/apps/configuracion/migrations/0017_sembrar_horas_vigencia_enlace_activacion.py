"""Siembra `captacion.horas_vigencia_enlace_activacion` (D-10): horas de vigencia del enlace de activación por correo.

Idempotente (no pisa un valor ya editado) y reversible (al retroceder borra solo esta clave).
"""
from django.db import migrations

PARAMETROS = (
    (
        'captacion.horas_vigencia_enlace_activacion',
        'Horas de vigencia del enlace de activación',
        'Horas que sirve el enlace que Captación envía por correo para que el postulante cree su contraseña. '
        'Nunca vence después de la ventana del expediente (se usa el menor de los dos plazos).',
        'entero', '48', 1, 168,
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
        ('configuracion', '0016_sembrar_horas_escalamiento_contacto'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
