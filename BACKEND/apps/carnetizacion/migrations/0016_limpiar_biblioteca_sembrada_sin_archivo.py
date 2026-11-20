"""Retira las filas de biblioteca que la siembra 0008 creó sin archivo.

La migración 0008 insertó tres medios con una clave de SeaweedFS que nunca se
subió. Esas filas hacen que el diseñador ofrezca recursos rotos (404) y que el
PDF dibuje un recuadro. Esta migración elimina únicamente esas filas fantasma:
las que coinciden con la siembra, no tienen archivo fuente asociado y no
fueron creadas por un usuario.

No hace I/O de red: la verificación real de SeaweedFS y la siembra desde los
archivos entregados por el área usuaria las hace el comando
``python manage.py verificar_biblioteca_institucional``.
"""
from django.db import migrations

# (nombre, clave) exactamente como los sembró la migración 0008.
MEDIOS_SEMBRADOS_SIN_ARCHIVO = (
    ('Logo Oficial CONATEL', 'logos/logo_conatel_oficial.png'),
    ('Firma Dirección General', 'firmas/firma_autoridad_dg.png'),
    ('Sello y Marca de Agua CONATEL', 'marcas/sello_institucional_seguridad.png'),
)


def limpiar_medios_huerfanos(apps, schema_editor):
    ElementoBiblioteca = apps.get_model('carnetizacion', 'ElementoBibliotecaModel')
    for nombre, clave in MEDIOS_SEMBRADOS_SIN_ARCHIVO:
        ElementoBiblioteca.objects.filter(
            nombre=nombre,
            archivo_clave=clave,
            creado_por__isnull=True,
        ).delete()


def restaurar_medios_huerfanos(apps, schema_editor):
    # No se recrean filas sin archivo: la reversión dejaría el mismo defecto.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0015_carnet_ciclo'),
    ]

    operations = [
        migrations.RunPython(
            limpiar_medios_huerfanos,
            reverse_code=restaurar_medios_huerfanos,
        ),
    ]
