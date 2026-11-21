"""Siembra los parámetros del grupo `captacion` (Fase 2: C-3, C-4, C-6 y C-7).

Idempotente (no pisa un valor ya editado) y reversible (al retroceder borra solo estas claves).
"""
from django.db import migrations

PARAMETROS = (
    (
        'captacion.vigencia_ventana1_dias',
        'Vigencia de la Ventana 1 del postulante (días)',
        'Días que el postulante tiene para completar y enviar sus datos (Ventana 1), '
        'contados desde que Captación le emite la credencial.',
        'entero', '15', 1, 90,
    ),
    (
        'captacion.vigencia_ventana2_dias',
        'Vigencia de la Ventana 2 del postulante (días)',
        'Días que el postulante tiene para consolidar su expediente (Ventana 2), '
        'contados desde que Captación la reabre tras la aprobación de la Dirección General.',
        'entero', '15', 1, 90,
    ),
    (
        'captacion.vigencia_reserva_puesto_dias',
        'Vigencia de la reserva de puesto (días)',
        'Días que dura la reserva de un puesto para un postulante, contados desde que '
        'Presupuesto la hace. Al vencer sin asignarse, el puesto vuelve a estar vacante.',
        'entero', '30', 1, 180,
    ),
    (
        'captacion.psicofisico_obligatorio',
        'Test psicofísico obligatorio',
        'Si está activo, Captación no puede continuar con un expediente sin haber '
        'registrado el resultado y el informe del test psicofísico. El sistema solo '
        'guarda el resultado y el informe; no aplica el test.',
        'booleano', 'true', None, None,
    ),
    (
        'captacion.retencion_rechazados_meses',
        'Retención de expedientes rechazados (meses)',
        'Meses que se conserva el expediente de un postulante rechazado antes de poder '
        'depurarlo. El valor definitivo lo fija Consultoría Jurídica; por defecto, 24 meses.',
        'entero', '24', 1, 120,
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
        ('configuracion', '0013_sembrar_sangrado_carnet'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
