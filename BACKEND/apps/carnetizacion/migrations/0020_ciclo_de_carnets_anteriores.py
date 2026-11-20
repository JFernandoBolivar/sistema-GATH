"""K-3: los carnets emitidos antes del control de ciclo físico (B-5) se marcan ENTREGADOS.

Sin esto, todo carnet activo sin fila en `CarnetCiclo` cuenta como «pendiente de impresión»
y la cola de impresión (ordenada del más antiguo al más nuevo, con tope) se llenaría de
carnets impresos hace años, tapando los recién emitidos. Solo se crea el ciclo de los que no
lo tienen; no se toca ningún carnet emitido después de aplicar esta migración.
"""
from django.db import migrations
from django.utils import timezone

NOTA = 'Anterior al control de ciclo físico (B-5)'


def marcar_anteriores(apps, schema_editor):
    # `CarnetEmitido` es una tabla heredada (managed=False): en una base nueva puede no existir.
    if 'CarnetEmitido' not in schema_editor.connection.introspection.table_names():
        return
    CarnetEmitido = apps.get_model('carnetizacion', 'CarnetEmitidoModel')
    CarnetCiclo = apps.get_model('carnetizacion', 'CarnetCicloModel')
    con_ciclo = set(CarnetCiclo.objects.values_list('carnet_id', flat=True))
    ahora = timezone.now()
    nuevos = [
        CarnetCiclo(
            carnet_id=pk,
            estado='ENTREGADO',
            fecha_entrega=ahora,
            recibido_por=NOTA,
        )
        for pk in CarnetEmitido.objects.filter(activo=True).values_list('pk', flat=True)
        if pk not in con_ciclo
    ]
    CarnetCiclo.objects.bulk_create(nuevos, batch_size=500)


def desmarcar(apps, schema_editor):
    CarnetCiclo = apps.get_model('carnetizacion', 'CarnetCicloModel')
    CarnetCiclo.objects.filter(recibido_por=NOTA).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0019_categoria_fondo'),
    ]

    operations = [
        migrations.RunPython(marcar_anteriores, reverse_code=desmarcar),
    ]
