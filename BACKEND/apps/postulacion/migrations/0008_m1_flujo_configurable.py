"""M-1: campos del proceso de ingreso configurable en el expediente y el Punto de Cuenta.

Expediente: `requiere_presupuesto` y `requiere_direccion_general` (copia del parámetro al abrirse;
true por defecto para que los expedientes anteriores no cambien de comportamiento).

Punto de Cuenta: `aprobado_fuera_sistema`, `fecha_firma`, `registrado_por_nombre` y los tres campos
del PDF firmado escaneado (clave opaca, sha256 y tamaño).
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('postulacion', '0007_enlace_activacion'),
    ]

    operations = [
        # Expediente: snapshot del proceso de ingreso al abrirse.
        migrations.AddField(
            model_name='expedientepostulacionmodel',
            name='requiere_presupuesto',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='expedientepostulacionmodel',
            name='requiere_direccion_general',
            field=models.BooleanField(default=True),
        ),
        # Punto de Cuenta: aprobación firmada fuera del sistema (Dirección General no en el sistema).
        migrations.AddField(
            model_name='puntocuentaingresomodel',
            name='aprobado_fuera_sistema',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='puntocuentaingresomodel',
            name='fecha_firma',
            field=models.DateField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='puntocuentaingresomodel',
            name='registrado_por_nombre',
            field=models.CharField(max_length=200, blank=True, default=''),
        ),
        migrations.AddField(
            model_name='puntocuentaingresomodel',
            name='pdf_firmado_clave',
            field=models.CharField(max_length=255, blank=True, default=''),
        ),
        migrations.AddField(
            model_name='puntocuentaingresomodel',
            name='pdf_firmado_sha256',
            field=models.CharField(max_length=64, blank=True, default=''),
        ),
        migrations.AddField(
            model_name='puntocuentaingresomodel',
            name='pdf_firmado_tamano',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
