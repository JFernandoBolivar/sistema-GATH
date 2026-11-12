from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('carnetizacion', '0011_indices_s5_04'),
    ]

    operations = [
        migrations.AddField(
            model_name='campopersonalizadomodel',
            name='origen',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
    ]
