"""O46/plantilla: logo oficial y color de FUNCIONARIO en las plantillas sembradas.

Actualiza de forma idempotente las dos plantillas institucionales ya creadas por
la migración 0008: agrega el asset del logo oficial y alinea el color de
FUNCIONARIO con el diseño aprobado del prototipo de carnet.
"""
import json

from django.db import migrations

NOMBRES = ('Plantilla Institucional Activos', 'Plantilla Institucional Pasivos')
LOGO = 'logo01.png'
FUNCIONARIO = {'primario': '#16264a', 'acento': '#d9121f', 'texto': '#ffffff'}


def actualizar_plantillas(apps, schema_editor):
    Plantilla = apps.get_model('carnetizacion', 'PlantillaCarnetModel')
    for plantilla in Plantilla.objects.filter(nombre__in=NOMBRES, activa=True):
        definicion = plantilla.definicion or {}
        if isinstance(definicion, str):
            definicion = json.loads(definicion)
        cambio = False

        for cara in ('anverso', 'reverso'):
            for elemento in definicion.get(cara, []):
                props = elemento.get('props') or {}
                if elemento.get('tipo') == 'image' and props.get('label') == 'LOGO':
                    if props.get('asset') != LOGO:
                        elemento.setdefault('props', {})['asset'] = LOGO
                        cambio = True

        reglas = definicion.get('reglas') or {}
        valores = reglas.get('valores') or {}
        actual = valores.get('FUNCIONARIO')
        if actual and (
            actual.get('primario') != FUNCIONARIO['primario']
            or actual.get('acento') != FUNCIONARIO['acento']
        ):
            valores['FUNCIONARIO'] = dict(FUNCIONARIO)
            reglas['valores'] = valores
            definicion['reglas'] = reglas
            cambio = True

        if cambio:
            plantilla.definicion = definicion
            plantilla.save(update_fields=['definicion'])


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0008_sembrar_plantillas_por_defecto'),
    ]

    operations = [
        migrations.RunPython(actualizar_plantillas, reverse_code=migrations.RunPython.noop),
    ]
