from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_auditorialog_dispositivo_auditorialog_hash_actual_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='BootstrapStateModel',
            fields=[
                ('clave', models.CharField(max_length=100, primary_key=True, serialize=False)),
                ('aplicado_en', models.DateTimeField(auto_now_add=True)),
                ('detalle', models.TextField(blank=True, default='')),
            ],
            options={
                'verbose_name': 'estado de bootstrap',
                'verbose_name_plural': 'estados de bootstrap',
                'db_table': 'core_bootstrap_state',
            },
        ),
    ]
