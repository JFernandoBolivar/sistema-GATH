# Generated for Tarea A11 (D20 Reportar error en datos laborales)
import core.infrastructure.models.base
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ReporteErrorDatoLaboralModel',
            fields=[
                ('id', models.UUIDField(default=core.infrastructure.models.base.uuid7, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('trabajador_cedula', models.CharField(db_index=True, max_length=15)),
                ('trabajador_nombre', models.CharField(blank=True, default='', max_length=200)),
                ('dato', models.CharField(choices=[('cargo', 'Cargo'), ('oficina', 'Oficina / Gerencia'), ('fecha_ingreso', 'Fecha de ingreso'), ('otro', 'Otro')], db_index=True, max_length=30)),
                ('descripcion', models.CharField(max_length=500)),
                ('estado', models.CharField(choices=[('PENDIENTE', 'Pendiente'), ('ATENDIDO', 'Atendido')], db_index=True, default='PENDIENTE', max_length=20)),
                ('atendido_por_id', models.IntegerField(blank=True, null=True)),
                ('atendido_por_cedula', models.CharField(blank=True, default='', max_length=20)),
                ('atendido_por_nombre', models.CharField(blank=True, default='', max_length=150)),
                ('atendido_el', models.DateTimeField(blank=True, null=True)),
                ('observacion_atencion', models.TextField(blank=True, default='')),
            ],
            options={
                'verbose_name': 'reporte de error laboral',
                'verbose_name_plural': 'reportes de error laboral',
                'db_table': 'personal_reporte_error_dato_laboral',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['estado', 'created_at'], name='personal_re_estado_e08d66_idx'),
                    models.Index(fields=['trabajador_cedula', 'estado'], name='personal_re_trabaja_22e70e_idx'),
                ],
            },
        ),
    ]
