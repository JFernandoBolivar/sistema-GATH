from django.db import migrations, models


class Migration(migrations.Migration):
    """Nuevo tipo de decisión CHECK_RETIRADO (solo cambia `choices`: sin cambios en el esquema de la tabla)."""

    dependencies = [
        ('fe_de_vida', '0003_devuelta_alcance_recordatorios'),
    ]

    operations = [
        migrations.AlterField(
            model_name='decisionfedevidamodel',
            name='tipo',
            field=models.CharField(choices=[('CHECK', 'Check'), ('CHECK_RETIRADO', 'Check Retirado'), ('APROBACION_DIRECTA', 'Aprobacion Directa'), ('RECHAZO', 'Rechazo'), ('DEVOLUCION', 'Devolucion')], max_length=20),
        ),
    ]
