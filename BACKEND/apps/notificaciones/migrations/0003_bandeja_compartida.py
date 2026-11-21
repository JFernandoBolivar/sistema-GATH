from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notificaciones', '0002_modulo_de_la_bandeja'),
    ]

    operations = [
        migrations.AddField(model_name='notificacionmodel', name='grupo', field=models.CharField(blank=True, default='', max_length=32)),
        migrations.AddField(model_name='notificacionmodel', name='atendida', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='notificacionmodel', name='atendida_por_cedula', field=models.CharField(blank=True, default='', max_length=20)),
        migrations.AddField(model_name='notificacionmodel', name='atendida_por_nombre', field=models.CharField(blank=True, default='', max_length=200)),
        migrations.AddField(model_name='notificacionmodel', name='fecha_atendida', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddIndex(
            model_name='notificacionmodel',
            index=models.Index(fields=['ref_tipo', 'ref_id', 'atendida'], name='notif_ref_atendida_idx'),
        ),
        migrations.AddIndex(
            model_name='notificacionmodel',
            index=models.Index(fields=['grupo'], name='notif_grupo_idx'),
        ),
    ]
