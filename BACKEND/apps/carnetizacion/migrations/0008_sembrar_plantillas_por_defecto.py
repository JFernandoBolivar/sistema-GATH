# Generated data migration for Punto 22: Sembrar plantillas de carnet y biblioteca por defecto
from django.db import migrations


def sembrar_plantillas_y_biblioteca(apps, schema_editor):
    TipoCredencial = apps.get_model('carnetizacion', 'TipoCredencialModel')
    PlantillaCarnet = apps.get_model('carnetizacion', 'PlantillaCarnetModel')

    # 1. Tipos de credencial
    tipo_trabajador, _ = TipoCredencial.objects.get_or_create(
        codigo='trabajador',
        defaults={
            'nombre': 'Trabajador Activo',
            'descripcion': 'Credencial oficial para personal activo institucional',
            'ancho_mm': 54.00,
            'alto_mm': 85.60,
            'orientacion': 'vertical',
            'activo': True,
            'orden': 1,
        },
    )

    tipo_pasivo, _ = TipoCredencial.objects.get_or_create(
        codigo='pasivo',
        defaults={
            'nombre': 'Pasivo / Jubilado / Pensionado',
            'descripcion': 'Credencial oficial para personal jubilado, pensionado o sobreviviente',
            'ancho_mm': 54.00,
            'alto_mm': 85.60,
            'orientacion': 'vertical',
            'activo': True,
            'orden': 2,
        },
    )

    # 2. Plantilla institucional Activos
    from apps.carnetizacion.domain.services.plantilla_defecto import (
        plantilla_defecto_trabajador,
        plantilla_defecto_pasivo,
    )

    if not PlantillaCarnet.objects.filter(tipo_credencial=tipo_trabajador, activa=True).exists():
        def_trab = plantilla_defecto_trabajador()
        p_act = PlantillaCarnet.objects.create(
            nombre='Plantilla Institucional Activos',
            tipo_credencial=tipo_trabajador,
            ancho_mm=def_trab['dimensiones']['ancho_mm'],
            alto_mm=def_trab['dimensiones']['alto_mm'],
            orientacion=def_trab['orientacion'],
            regla_criterio='nomina',
            regla_valor='*',
            estado='publicada',
            activa=True,
            version=1,
            definicion=def_trab,
            descripcion='Plantilla oficial institucional para personal activo con franja de color según tipo de nómina.',
        )
        p_act.plantilla_raiz = p_act
        p_act.save(update_fields=['plantilla_raiz'])

    # 3. Plantilla institucional Pasivos
    if not PlantillaCarnet.objects.filter(tipo_credencial=tipo_pasivo, activa=True).exists():
        def_pas = plantilla_defecto_pasivo()
        p_pas = PlantillaCarnet.objects.create(
            nombre='Plantilla Institucional Pasivos',
            tipo_credencial=tipo_pasivo,
            ancho_mm=def_pas['dimensiones']['ancho_mm'],
            alto_mm=def_pas['dimensiones']['alto_mm'],
            orientacion=def_pas['orientacion'],
            regla_criterio='unico',
            regla_valor='*',
            estado='publicada',
            activa=True,
            version=1,
            definicion=def_pas,
            descripcion='Plantilla oficial institucional para personal jubilado y pensionado con franjas verdes y anverso/reverso.',
        )
        p_pas.plantilla_raiz = p_pas
        p_pas.save(update_fields=['plantilla_raiz'])

    # 4. Elementos de biblioteca.
    # No se siembran filas con claves de archivo que no existen en SeaweedFS:
    # eso producía 404 en el diseñador y un recuadro en el PDF. Los medios
    # institucionales se siembran con `manage.py verificar_biblioteca_institucional`
    # cuando el área usuaria entrega los archivos. La migración 0016 retira las
    # filas fantasma creadas por versiones anteriores de esta migración.


def revertir_sembrado(apps, schema_editor):
    # No destructivo: las plantillas creadas pueden tener carnets vinculados
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0007_eventos'),
    ]

    operations = [
        migrations.RunPython(sembrar_plantillas_y_biblioteca, reverse_code=revertir_sembrado),
    ]
