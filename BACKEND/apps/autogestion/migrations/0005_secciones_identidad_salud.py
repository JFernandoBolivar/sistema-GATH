"""
O10 (D19/D21): secciones autogestionables `identidad` y `salud`. Idempotente.

- `identidad`: nombres, apellidos, fecha de nacimiento y cédula (con copia de cédula),
  además de estado civil y Carnet de la Patria (sin documento).
- `salud`: perfil de salud (grupo sanguíneo, alergias, patologías y discapacidades) y
  tallas del perfil físico. Sin documento (pendiente R1, decisión D21).
"""
from django.db import migrations

SECCIONES = (
    ('identidad', 'Identidad (nombres, apellidos, fecha de nacimiento y cédula)', False),
    ('salud', 'Salud y tallas', False),
)


def sembrar(apps, schema_editor):
    Seccion = apps.get_model('autogestion', 'SeccionAutogestionableModel')
    for codigo, nombre, requiere_soporte in SECCIONES:
        Seccion.objects.get_or_create(
            codigo=codigo,
            defaults={'nombre': nombre, 'requiere_soporte': requiere_soporte, 'activa': True},
        )


def borrar(apps, schema_editor):
    Seccion = apps.get_model('autogestion', 'SeccionAutogestionableModel')
    Seccion.objects.filter(codigo__in=[s[0] for s in SECCIONES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('autogestion', '0004_acciones_por_registro'),
    ]

    operations = [
        migrations.RunPython(sembrar, borrar),
    ]
