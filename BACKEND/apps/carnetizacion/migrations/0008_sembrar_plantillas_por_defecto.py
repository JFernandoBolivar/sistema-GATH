# Generated data migration for Punto 22: Sembrar plantillas de carnet y biblioteca por defecto
from django.db import migrations


def sembrar_plantillas_y_biblioteca(apps, schema_editor):
    TipoCredencial = apps.get_model('carnetizacion', 'TipoCredencialModel')
    PlantillaCarnet = apps.get_model('carnetizacion', 'PlantillaCarnetModel')
    ElementoBiblioteca = apps.get_model('carnetizacion', 'ElementoBibliotecaModel')

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

    # 4. Elementos de biblioteca iniciales (logos / firma institucional)
    elementos = [
        {
            'nombre': 'Logo Oficial CONATEL',
            'categoria': 'logo',
            'archivo_clave': 'logos/logo_conatel_oficial.png',
            'nombre_archivo': 'logo_conatel_oficial.png',
            'tamano_bytes': 24500,
            'mime_type': 'image/png',
            'ancho_px': 450,
            'alto_px': 140,
            'descripcion': 'Isotipo y logotipo oficial de la Comisión Nacional de Telecomunicaciones.',
        },
        {
            'nombre': 'Firma Dirección General',
            'categoria': 'firma',
            'archivo_clave': 'firmas/firma_autoridad_dg.png',
            'nombre_archivo': 'firma_autoridad_dg.png',
            'tamano_bytes': 18200,
            'mime_type': 'image/png',
            'ancho_px': 320,
            'alto_px': 120,
            'descripcion': 'Rúbrica autorizada para emisión y verificación de credenciales institucionales.',
        },
        {
            'nombre': 'Sello y Marca de Agua CONATEL',
            'categoria': 'imagen',
            'archivo_clave': 'marcas/sello_institucional_seguridad.png',
            'nombre_archivo': 'sello_institucional_seguridad.png',
            'tamano_bytes': 31000,
            'mime_type': 'image/png',
            'ancho_px': 300,
            'alto_px': 300,
            'descripcion': 'Sello de seguridad institucional para fondos y reverso de carnet.',
        },
    ]

    for elem in elementos:
        if not ElementoBiblioteca.objects.filter(nombre=elem['nombre']).exists():
            ElementoBiblioteca.objects.create(**elem)


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
