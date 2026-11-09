from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0006_politica_correo_acceso'),
    ]

    operations = [
        migrations.AlterField(
            model_name='politicacorreoaccesomodel',
            name='politica_pasivos',
            field=models.CharField(
                choices=[
                    ('alternativo', 'Alternativo'),
                    ('institucional', 'Institucional'),
                    ('correo_ficha', 'Correo de la ficha'),
                ],
                default='institucional',
                help_text='Fuente primaria de correo para pasivos y sobrevivientes.',
                max_length=20,
            ),
        ),
    ]
