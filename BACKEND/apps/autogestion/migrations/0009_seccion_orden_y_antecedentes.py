"""
Migración 0009: agregar campo orden a SeccionAutogestionableModel,
sembrar orden inicial (identidad, foto, contacto, etc.) y sembrar la sección
antecedentes_servicio si no existía (O37). Idempotente.
"""
from django.db import migrations, models


SECCIONES_ORDENADAS = (
    ('identidad', 'Identidad (nombres, apellidos, fecha de nacimiento y cédula)', False, 1),
    ('foto', 'Foto', False, 2),
    ('contacto', 'Contacto (teléfonos, correo alternativo y contacto de emergencia)', False, 3),
    ('vivienda', 'Vivienda', False, 4),
    ('formacion', 'Formación académica', True, 5),
    ('complementaria', 'Formación complementaria (cursos y capacitaciones)', True, 6),
    ('familiar', 'Grupo familiar', True, 7),
    ('salud', 'Salud y tallas', False, 8),
    ('antecedentes', 'Antecedentes de servicio', True, 9),
)


def sembrar_orden_y_antecedentes(apps, schema_editor):
    Seccion = apps.get_model('autogestion', 'SeccionAutogestionableModel')
    for codigo, nombre, requiere_soporte, orden in SECCIONES_ORDENADAS:
        obj, created = Seccion.objects.get_or_create(
            codigo=codigo,
            defaults={
                'nombre': nombre,
                'requiere_soporte': requiere_soporte,
                'activa': True,
                'orden': orden,
            },
        )
        if not created:
            obj.orden = orden
            obj.save(update_fields=['orden'])


class Migration(migrations.Migration):

    dependencies = [
        ('autogestion', '0008_soporte_tipo_largo'),
    ]

    operations = [
        migrations.AddField(
            model_name='seccionautogestionablemodel',
            name='orden',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name='seccionautogestionablemodel',
            options={'ordering': ['orden', 'created_at', 'codigo']},
        ),
        migrations.RunPython(sembrar_orden_y_antecedentes, migrations.RunPython.noop),
    ]
