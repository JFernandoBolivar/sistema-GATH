"""Siembra la vigencia del carnet por tipo y ajusta la global (que pasa a ser respaldo).

La clave global `carnetizacion.vencimiento_meses` ya existía con 0 = «sin vencimiento»;
ahora los carnets sí vencen, por lo que un 0 guardado pasa a 12 y el rango queda 1–60.
"""
from django.db import migrations

CLAVE_GLOBAL = 'carnetizacion.vencimiento_meses'

NUEVOS = (
    (
        'carnetizacion.vigencia_trabajador_meses',
        'Vigencia del carnet de trabajador activo (meses)',
        'Meses de vigencia del carnet de un trabajador activo, contados desde su emisión. '
        'Se fija al emitir: cambiarla no altera los carnets ya emitidos.',
        '12', 1, 60,
    ),
    (
        'carnetizacion.vigencia_pasivo_meses',
        'Vigencia del carnet de pasivo o jubilado (meses)',
        'Meses de vigencia del carnet de un pasivo o jubilado, contados desde su emisión. '
        'Se fija al emitir: cambiarla no altera los carnets ya emitidos.',
        '12', 1, 60,
    ),
    (
        'carnetizacion.vigencia_externo_dias',
        'Vigencia de la credencial de externo, visitante o temporal (días)',
        'Días de vigencia por defecto de una credencial externa, visitante o temporal '
        'cuando al crearla no se indica la fecha final.',
        '30', 1, 365,
    ),
)

ETIQUETA_GLOBAL = 'Vigencia general del carnet, respaldo (meses)'
DESCRIPCION_GLOBAL = (
    'Meses de vigencia que se aplican cuando la vigencia del tipo de carnet no está '
    'definida. Se fija al emitir: cambiarla no altera los carnets ya emitidos.'
)


def sembrar(apps, schema_editor):
    Parametro = apps.get_model('configuracion', 'ParametroSistemaModel')
    for clave, etiqueta, descripcion, valor, minimo, maximo in NUEVOS:
        Parametro.objects.get_or_create(
            clave=clave,
            defaults={
                'etiqueta': etiqueta,
                'descripcion': descripcion,
                'grupo': 'carnetizacion',
                'tipo': 'entero',
                'valor': valor,
                'valor_min': minimo,
                'valor_max': maximo,
            },
        )
    fila = Parametro.objects.filter(clave=CLAVE_GLOBAL).first()
    if fila is None:
        Parametro.objects.create(
            clave=CLAVE_GLOBAL,
            etiqueta=ETIQUETA_GLOBAL,
            descripcion=DESCRIPCION_GLOBAL,
            grupo='carnetizacion',
            tipo='entero',
            valor='12',
            valor_min=1,
            valor_max=60,
        )
        return
    fila.etiqueta = ETIQUETA_GLOBAL
    fila.descripcion = DESCRIPCION_GLOBAL
    fila.valor_min = 1
    fila.valor_max = 60
    texto = (fila.valor or '').strip()
    if not texto.isdigit() or int(texto) < 1:
        fila.valor = '12'
    fila.save()


def retirar(apps, schema_editor):
    Parametro = apps.get_model('configuracion', 'ParametroSistemaModel')
    Parametro.objects.filter(clave__in=[n[0] for n in NUEVOS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0011_sembrar_qr_tamano_minimo'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
