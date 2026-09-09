# Shim de estado (sin DDL real). La app USER fue migrada originalmente
# fuera de este repositorio: django_migrations ya registra USER.0001_initial
# (aplicada 2026-01-20) y varias 0002_* aplicadas despues, pero los archivos
# de migracion originales nunca quedaron en el repo/imagen; las tablas
# USER_departaments/USER_rol/USER_cuenta ya existen fisicamente en la BD.
#
# Sin este archivo, Django trata la migracion nueva (0004_audit_log) como
# la "primera" de la app USER, lo que rompe:
#  1) la dependencia implicita de `admin` sobre el primer migration de USER
#     (AUTH_USER_MODEL = USER.cuenta) -- admin.0001_initial ya esta
#     aplicada y exige que el "__first__" de USER tambien lo este.
#  2) la resolucion de referencias lazy hacia 'USER.cuenta' desde
#     admin.LogEntry.user y token_blacklist.OutstandingToken.user, que
#     fallan con "app 'USER' isn't installed" si el estado de USER queda
#     vacio.
#
# Por eso se usa SeparateDatabaseAndState: state_operations reconstruye el
# estado (los mismos campos que el modelo real actual) para que esas
# referencias lazy resuelvan, pero database_operations queda vacio -- no se
# ejecuta ningun DDL, no se toca ninguna tabla existente. Al estar ya
# marcada como aplicada en django_migrations, Django tampoco la re-ejecuta.
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('RAC', '__first__'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='departaments',
                    fields=[
                        ('id', models.AutoField(primary_key=True, serialize=False)),
                        ('nombre_departamento', models.CharField(max_length=100, unique=True)),
                        ('descripcion_departamento', models.TextField(blank=True, null=True)),
                    ],
                    options={'managed': True},
                ),
                migrations.CreateModel(
                    name='Rol',
                    fields=[
                        ('id', models.AutoField(primary_key=True, serialize=False)),
                        ('nombre_rol', models.CharField(max_length=50, unique=True)),
                        ('descripcion_rol', models.TextField(blank=True, null=True)),
                    ],
                    options={'managed': True},
                ),
                migrations.CreateModel(
                    name='cuenta',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('password', models.CharField(max_length=128, verbose_name='password')),
                        ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                        ('is_active', models.BooleanField(default=True)),
                        ('cedula', models.OneToOneField(db_column='cedula', on_delete=django.db.models.deletion.CASCADE, to='RAC.employee', to_field='cedulaidentidad')),
                        ('departamento', models.ForeignKey(blank=True, db_column='departamento_id', null=True, on_delete=django.db.models.deletion.CASCADE, to='USER.departaments')),
                        ('rol', models.ForeignKey(blank=True, db_column='rol_id', null=True, on_delete=django.db.models.deletion.SET_NULL, to='USER.rol')),
                    ],
                    options={'managed': True},
                ),
            ],
            database_operations=[],
        ),
    ]
