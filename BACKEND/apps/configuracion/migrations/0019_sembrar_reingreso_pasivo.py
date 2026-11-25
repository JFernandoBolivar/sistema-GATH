"""Siembra el parámetro `captacion.reingreso_pasivo` (C-9): qué pasa cuando un jubilado o pensionado reingresa por Captación.

Valores: `permitir` (por defecto, el comportamiento de siempre), `cerrar_al_contratar` y `no_permitir`.
Idempotente (no pisa un valor ya editado) y reversible (al retroceder borra solo esta clave).
"""
from django.db import migrations

CLAVE = 'captacion.reingreso_pasivo'
ETIQUETA = 'Reingreso de jubilados y pensionados'
DESCRIPCION = (
    'Qué ocurre cuando un jubilado o pensionado (trabajador pasivo) se postula por Captación. «Permitir»: '
    'puede postularse y, al contratarlo, su registro de pasivo queda como está. «Cerrar al contratar»: puede '
    'postularse y, al contratarlo, el sistema cierra su condición de pasivo (egreso del pasivo) en la misma '
    'operación. «No permitir»: el alta del postulante se rechaza. Aplica a los expedientes que se abran '
    'desde ahora; los que ya están en curso conservan la opción con que se abrieron.'
)


def sembrar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    ParametroSistema.objects.get_or_create(
        clave=CLAVE,
        defaults={
            'etiqueta': ETIQUETA, 'descripcion': DESCRIPCION, 'grupo': 'captacion', 'tipo': 'texto', 'valor': 'permitir',
            'valor_min': None, 'valor_max': None,
        },
    )


def retirar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    ParametroSistema.objects.filter(clave=CLAVE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0018_sembrar_proceso_ingreso'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
