"""
O7: acciones por registro (agregar/corregir/quitar) y documentos POR REGISTRO.

- `CambioPropuesto.referencia`: une un registro nuevo (CREAR) con sus soportes mientras no
  existe todavía en la ficha.
- `SoporteDocumental.entidad_id` / `referencia`: el soporte se asocia al registro concreto
  (existente o nuevo) y no solo a la sección.
- Nueva sección `complementaria` (formación complementaria) y tipo de soporte `CEDULA`.
"""
from django.db import migrations, models


def sembrar_complementaria(apps, schema_editor):
    Seccion = apps.get_model('autogestion', 'SeccionAutogestionableModel')
    Seccion.objects.get_or_create(
        codigo='complementaria',
        defaults={
            'nombre': 'Formación complementaria (cursos y capacitaciones)',
            'requiere_soporte': True,
            'activa': True,
        },
    )


def borrar_complementaria(apps, schema_editor):
    Seccion = apps.get_model('autogestion', 'SeccionAutogestionableModel')
    Seccion.objects.filter(codigo='complementaria').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('autogestion', '0003_campos_devuelta'),
    ]

    operations = [
        migrations.AddField(
            model_name='cambiopropuestomodel',
            name='referencia',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='soportedocumentalmodel',
            name='entidad_id',
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name='soportedocumentalmodel',
            name='referencia',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.RunPython(sembrar_complementaria, borrar_complementaria),
    ]
