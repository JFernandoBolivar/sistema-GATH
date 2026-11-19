from django.db import migrations, models
from django.utils import timezone


def marcar_reemplazadas(apps, schema_editor):
    """Deja una sola prórroga vigente por alcance (general o cédula).

    En datos anteriores podían convivir varias prórrogas activas del mismo alcance. Se conserva la
    que tiene la fecha límite más lejana (y, en empate, la creada más recientemente); las demás se
    marcan como reemplazadas por esa. No se borra ninguna: quedan en el historial.
    """
    Prorroga = apps.get_model('fe_de_vida', 'ProrrogaProcesoModel')
    ahora = timezone.now()
    procesos = Prorroga.objects.values_list('proceso_id', flat=True).distinct()
    for proceso_id in procesos:
        cedulas = Prorroga.objects.filter(proceso_id=proceso_id).values_list('cedula', flat=True).distinct()
        for cedula in cedulas:
            activas = Prorroga.objects.filter(
                proceso_id=proceso_id,
                cedula=cedula,
                nueva_fecha_limite__gte=ahora,
                reemplazada_por__isnull=True,
            ).order_by('-nueva_fecha_limite', '-created_at')
            vigente = activas.first()
            if vigente is None:
                continue
            activas.exclude(pk=vigente.pk).update(
                reemplazada_por=vigente, reemplazada_en=ahora,
            )


class Migration(migrations.Migration):

    dependencies = [
        ('fe_de_vida', '0010_constancia_datos_planilla'),
    ]

    operations = [
        migrations.AddField(
            model_name='ProrrogaProcesoModel',
            name='reemplazada_por',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=models.deletion.PROTECT,
                related_name='reemplaza_a', to='fe_de_vida.prorrogaprocesomodel',
            ),
        ),
        migrations.AddField(
            model_name='ProrrogaProcesoModel',
            name='reemplazada_en',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(marcar_reemplazadas, migrations.RunPython.noop),
    ]
