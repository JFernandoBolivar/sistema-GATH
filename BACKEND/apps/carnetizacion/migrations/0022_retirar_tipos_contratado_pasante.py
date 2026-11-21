"""K-11: se retiran los tipos de credencial «contratado» y «pasante».

Un contratado o un pasante es un trabajador con su tipo de nómina: su carnet usa la
credencial «trabajador» y el diseño (color) que la plantilla asigna a esa nómina. Tener
tipos de credencial aparte duplicaba esa regla y confundía. Si alguno ya tiene plantillas
o credenciales emitidas, no se borra: se desactiva.
"""
from django.db import migrations

TIPOS = {
    'contratado': ('Contratado', 3),
    'pasante': ('Pasante', 4),
}


def aplicar(apps, schema_editor):
    Tipo = apps.get_model('carnetizacion', 'TipoCredencialModel')
    Plantilla = apps.get_model('carnetizacion', 'PlantillaCarnetModel')
    Externa = apps.get_model('carnetizacion', 'CredencialExternaModel')
    for codigo in TIPOS:
        tipo = Tipo.objects.filter(codigo=codigo).first()
        if tipo is None:
            continue
        en_uso = (
            Plantilla.objects.filter(tipo_credencial_id=codigo).exists()
            or Externa.objects.filter(tipo_credencial_id=codigo).exists()
        )
        if en_uso:
            tipo.activo = False
            tipo.save(update_fields=['activo'])
        else:
            tipo.delete()


def revertir(apps, schema_editor):
    Tipo = apps.get_model('carnetizacion', 'TipoCredencialModel')
    for codigo, (nombre, orden) in TIPOS.items():
        Tipo.objects.get_or_create(
            codigo=codigo,
            defaults={'nombre': nombre, 'grupo': 'externo', 'orden': orden, 'activo': True},
        )
        Tipo.objects.filter(codigo=codigo).update(activo=True)


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0021_retirar_tipo_autoridad'),
    ]

    operations = [
        migrations.RunPython(aplicar, revertir),
    ]
