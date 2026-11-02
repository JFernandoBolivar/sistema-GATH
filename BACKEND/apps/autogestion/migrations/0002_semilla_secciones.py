"""
Semilla del catálogo de secciones autogestionables (PLAN_PRIORIDAD §2.3, B1). Idempotente.

Solo inserta las que faltan; nunca pisa lo que Bienestar haya configurado después.
"""
from django.db import migrations

SECCIONES = (
    # (codigo, nombre, requiere_soporte)
    ('contacto', 'Contacto (teléfonos, correo alternativo y contacto de emergencia)', False),
    ('vivienda', 'Vivienda', False),
    ('formacion', 'Formación académica', True),
    ('familiar', 'Grupo familiar', True),
    ('foto', 'Foto', False),
)


def sembrar(apps, schema_editor):
    Seccion = apps.get_model('autogestion', 'SeccionAutogestionableModel')
    for codigo, nombre, requiere_soporte in SECCIONES:
        Seccion.objects.get_or_create(
            codigo=codigo, defaults={'nombre': nombre, 'requiere_soporte': requiere_soporte, 'activa': True},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('autogestion', '0001_solicitudes_actualizacion'),
    ]

    operations = [
        migrations.RunPython(sembrar, migrations.RunPython.noop),
    ]
