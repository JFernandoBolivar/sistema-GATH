# Generated manually for PRUEBAS-USUARIO (Punto 11)

from django.db import migrations


def normalizar_ciudad_region_existentes(apps, schema_editor):
    """Normaliza la tabla física `datos_vivienda`.

    `DatosViviendaModel` es `managed = False` (tabla espejo heredada), así que
    `apps.get_model` no expone `ciudad_region` en el estado histórico: se usa
    SQL directo sobre la tabla real.
    """
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT id, ciudad_region FROM datos_vivienda "
            "WHERE ciudad_region IS NOT NULL AND ciudad_region <> ''"
        )
        filas = cursor.fetchall()
        for pk, original in filas:
            limpio = ' '.join(str(original).split()).upper()[:120]
            if limpio != original:
                cursor.execute(
                    "UPDATE datos_vivienda SET ciudad_region = %s WHERE id = %s",
                    [limpio, pk],
                )


def revertir(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('personal', '0002_alergiamodel_antecedenteserviciomodel_and_more'),
    ]

    operations = [
        migrations.RunPython(normalizar_ciudad_region_existentes, reverse_code=revertir),
    ]
