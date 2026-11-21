"""K-11: «autoridad» se retira y «contratado»/«pasante» pasan a credenciales externas.

Los trabajadores (incluidos los contratados y pasantes con expediente) usan el tipo
«trabajador»: el color de su carnet sale de la regla por tipo de nómina de la plantilla.
«Alto Nivel» es la nómina FUNCIONARIO, así que no hace falta un tipo «autoridad».
Si «autoridad» ya tiene plantillas o credenciales, no se borra: se desactiva.
"""
from django.db import migrations

EXTERNOS = {
    'contratado': 'Credencial externa para personal contratado sin expediente en el sistema',
    'pasante': 'Credencial externa para pasantes sin expediente en el sistema',
}


def aplicar(apps, schema_editor):
    Tipo = apps.get_model('carnetizacion', 'TipoCredencialModel')
    Plantilla = apps.get_model('carnetizacion', 'PlantillaCarnetModel')
    Externa = apps.get_model('carnetizacion', 'CredencialExternaModel')

    autoridad = Tipo.objects.filter(codigo='autoridad').first()
    if autoridad is not None:
        en_uso = (
            Plantilla.objects.filter(tipo_credencial_id='autoridad').exists()
            or Externa.objects.filter(tipo_credencial_id='autoridad').exists()
        )
        if en_uso:
            autoridad.activo = False
            autoridad.save(update_fields=['activo'])
        else:
            autoridad.delete()

    for codigo, descripcion in EXTERNOS.items():
        Tipo.objects.filter(codigo=codigo, grupo='trabajador').update(grupo='externo', descripcion=descripcion)


def revertir(apps, schema_editor):
    Tipo = apps.get_model('carnetizacion', 'TipoCredencialModel')
    Tipo.objects.filter(codigo__in=list(EXTERNOS), grupo='externo').update(grupo='trabajador')
    Tipo.objects.get_or_create(
        codigo='autoridad',
        defaults={
            'nombre': 'Autoridad',
            'descripcion': 'Credencial oficial para autoridades y directivos de la institución',
            'grupo': 'trabajador', 'orden': 5, 'activo': True,
        },
    )
    Tipo.objects.filter(codigo='autoridad').update(activo=True)


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0020_ciclo_de_carnets_anteriores'),
    ]

    operations = [
        migrations.RunPython(aplicar, revertir),
    ]
