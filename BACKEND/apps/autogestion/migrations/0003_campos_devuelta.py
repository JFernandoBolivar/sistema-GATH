"""
B16 (decisión G): solicitud campo por campo y estado DEVUELTA.

Agrega los campos solicitados/habilitados y los datos de la última devolución; rellena las solicitudes
existentes con todos los campos de sus secciones (equivale a lo que ya podían editar).
"""
from django.db import migrations, models

from apps.autogestion.domain.value_objects.secciones import campos_de_secciones


def rellenar_campos(apps, schema_editor):
    Solicitud = apps.get_model('autogestion', 'SolicitudActualizacionModel')
    for s in Solicitud.objects.all():
        s.campos_solicitados = list(campos_de_secciones(s.secciones_solicitadas or ()))
        s.campos_habilitados = list(campos_de_secciones(s.secciones_habilitadas or ()))
        s.save(update_fields=['campos_solicitados', 'campos_habilitados'])


class Migration(migrations.Migration):

    dependencies = [
        ('autogestion', '0002_semilla_secciones'),
    ]

    operations = [
        migrations.AddField(model_name='solicitudactualizacionmodel', name='campos_solicitados',
                            field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name='solicitudactualizacionmodel', name='campos_habilitados',
                            field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name='solicitudactualizacionmodel', name='motivo_devolucion',
                            field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='solicitudactualizacionmodel', name='devuelta_por',
                            field=models.CharField(blank=True, default='', max_length=15)),
        migrations.AddField(model_name='solicitudactualizacionmodel', name='fecha_devolucion',
                            field=models.DateTimeField(blank=True, null=True)),
        migrations.AlterField(
            model_name='solicitudactualizacionmodel', name='estado',
            field=models.CharField(choices=[
                ('SOLICITADA', 'Solicitada'), ('HABILITADA', 'Habilitada'), ('ENVIADA', 'Enviada'),
                ('DEVUELTA', 'Devuelta'), ('APROBADA', 'Aprobada'), ('APROBADA_PARCIAL', 'Aprobada Parcial'),
                ('RECHAZADA', 'Rechazada'), ('EXPIRADA', 'Expirada')], default='SOLICITADA', max_length=20),
        ),
        migrations.RunPython(rellenar_campos, migrations.RunPython.noop),
    ]
