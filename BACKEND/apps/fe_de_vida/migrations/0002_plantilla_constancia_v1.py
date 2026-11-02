"""Datos: plantilla v1 de la constancia de fe de vida (PLAN §2.11, confirmada por el usuario). Idempotente y reversible."""
from django.db import migrations

TITULO = 'CONSTANCIA DE COMPARECENCIA O FE DE VIDA'
TEXTO = (
    'Se hace constar que el día {fecha} el/la ciudadano(a) {nombre_completo}, titular de la C.I. N.° {cedula}, '
    '{condicion}, compareció de forma digital ante la Oficina de Gestión Humana de la Comisión Nacional de '
    'Telecomunicaciones (CONATEL), para dejar constancia de su fe de vida.'
)


def sembrar(apps, schema_editor):
    Plantilla = apps.get_model('fe_de_vida', 'PlantillaConstanciaModel')
    Plantilla.objects.get_or_create(version=1, defaults={'titulo': TITULO, 'texto': TEXTO, 'activa': True})


def deshacer(apps, schema_editor):
    apps.get_model('fe_de_vida', 'PlantillaConstanciaModel').objects.filter(version=1, titulo=TITULO).delete()


class Migration(migrations.Migration):
    dependencies = [('fe_de_vida', '0001_initial')]
    operations = [migrations.RunPython(sembrar, deshacer)]
