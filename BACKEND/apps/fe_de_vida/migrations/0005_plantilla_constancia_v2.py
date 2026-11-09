"""
Datos: plantilla v2 de la constancia de fe de vida. Por pedido de RRHH (2026-10-30) el texto ya no dice
«de forma digital», como en la planilla física. La v1 queda inactiva (las constancias emitidas con ella
conservan su versión). Idempotente y reversible.
"""
from django.db import migrations

TITULO = 'CONSTANCIA DE COMPARECENCIA O FE DE VIDA'
TEXTO = (
    'Se hace constar que el día {fecha} el/la ciudadano(a) {nombre_completo}, titular de la C.I. N.° {cedula}, '
    '{condicion}, compareció ante la Oficina de Gestión Humana de la Comisión Nacional de '
    'Telecomunicaciones (CONATEL), para dejar constancia de su fe de vida.'
)


def sembrar(apps, schema_editor):
    Plantilla = apps.get_model('fe_de_vida', 'PlantillaConstanciaModel')
    Plantilla.objects.filter(version=1).update(activa=False)
    Plantilla.objects.update_or_create(version=2, defaults={'titulo': TITULO, 'texto': TEXTO, 'activa': True})


def deshacer(apps, schema_editor):
    Plantilla = apps.get_model('fe_de_vida', 'PlantillaConstanciaModel')
    Plantilla.objects.filter(version=2, titulo=TITULO).delete()
    Plantilla.objects.filter(version=1).update(activa=True)


class Migration(migrations.Migration):
    dependencies = [('fe_de_vida', '0004_check_retirado')]
    operations = [migrations.RunPython(sembrar, deshacer)]
