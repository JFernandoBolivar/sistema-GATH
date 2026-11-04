"""
Siembra del histórico: si ya hay una imagen vigente cargada por campo, crea su
versión inicial (vigente) para que aparezca en «Versiones anteriores».
"""
from django.db import migrations

CAMPOS = ('logo_principal_clave', 'logo_secundario_clave', 'cintillo_pie_clave')
MIME_POR_EXTENSION = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}


def sembrar(apps, schema_editor):
    Config = apps.get_model('configuracion', 'ConfiguracionVisualModel')
    Version = apps.get_model('configuracion', 'VersionImagenCintilloModel')
    fila = Config.objects.first()
    if fila is None:
        return
    for campo in CAMPOS:
        clave = getattr(fila, campo)
        if not clave or Version.objects.filter(campo=campo, clave=clave).exists():
            continue
        extension = clave.rsplit('.', 1)[-1].lower() if '.' in clave else ''
        Version.objects.create(
            campo=campo, clave=clave,
            mime=MIME_POR_EXTENSION.get(extension, 'application/octet-stream'),
            tamano=0,
            subido_por_id=fila.actualizado_por_id,
            es_vigente=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0004_versionimagencintillomodel'),
    ]

    operations = [
        migrations.RunPython(sembrar, migrations.RunPython.noop),
    ]
