"""Siembra los parámetros del proceso de ingreso configurable (M-1).

`captacion.requiere_presupuesto` y `captacion.requiere_direccion_general` (por defecto activos: el flujo de siempre).
Idempotente (no pisa un valor ya editado) y reversible (al retroceder borra solo estas claves).
"""
from django.db import migrations

PARAMETROS = (
    (
        'captacion.requiere_presupuesto',
        'El ingreso pasa por Presupuesto en el sistema',
        'Si está activo, el expediente pasa por la etapa de Presupuesto (reserva del puesto y constancia '
        'presupuestaria) dentro del sistema. Si se desactiva, Presupuesto se gestiona fuera del sistema: Captación '
        'reserva el puesto vacante y genera el Punto de Cuenta de ingreso. Aplica a los expedientes que se abran '
        'desde ahora; los que ya están en curso conservan la configuración con que se abrieron.',
        'booleano', 'true',
    ),
    (
        'captacion.requiere_direccion_general',
        'El ingreso lo aprueba la Dirección General en el sistema',
        'Si está activo, la Dirección General aprueba o rechaza el ingreso dentro del sistema. Si se desactiva, la '
        'aprobación se firma fuera del sistema (Punto de Cuenta impreso) y Captación registra la aprobación con la '
        'fecha de la firma y, si lo desea, el Punto de Cuenta firmado escaneado. Aplica a los expedientes que se '
        'abran desde ahora; los que ya están en curso conservan la configuración con que se abrieron.',
        'booleano', 'true',
    ),
)


def sembrar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    for clave, etiqueta, descripcion, tipo, valor in PARAMETROS:
        ParametroSistema.objects.get_or_create(
            clave=clave,
            defaults={
                'etiqueta': etiqueta, 'descripcion': descripcion, 'grupo': 'captacion', 'tipo': tipo, 'valor': valor,
                'valor_min': None, 'valor_max': None,
            },
        )


def retirar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    ParametroSistema.objects.filter(clave__in=[p[0] for p in PARAMETROS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0017_sembrar_horas_vigencia_enlace_activacion'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
