"""Siembra `documentos.generar_bajo_demanda` y la asegura para ADMINISTRADOR.

Corre después de la última siembra de permisos. La asignación explícita es
idempotente y no depende del ID histórico del rol. Al retroceder no se borra el
permiso ni la matriz: podrían estar usándose.
"""
from django.core.management import call_command
from django.db import migrations
from django.db.models import F

PERMISO = 'documentos.generar_bajo_demanda'


def _modelo(apps, *nombres):
    for nombre in nombres:
        try:
            return apps.get_model('identidad', nombre)
        except LookupError:
            continue
    raise LookupError(f'Modelo de identidad no disponible: {nombres}')


def aplicar(apps, schema_editor):
    call_command('seed_permisos')
    alias = schema_editor.connection.alias
    Permiso = apps.get_model('identidad', 'PermisoModel')
    RolPermiso = apps.get_model('identidad', 'RolPermisoModel')
    PermisosVersion = apps.get_model('identidad', 'PermisosVersionModel')
    # El estado histórico conserva los espejos legados; el registro global de
    # pruebas expone los modelos canónicos. Ambos se obtienen del registro, sin
    # importar modelos vivos dentro de la migración.
    Rol = _modelo(apps, 'RolModel', 'RolEspejo')
    Cuenta = _modelo(apps, 'CuentaModel', 'CuentaEspejo')

    permiso = Permiso.objects.using(alias).filter(codigo=PERMISO).first()
    if permiso is None:
        return
    for rol in Rol.objects.using(alias).filter(nombre_rol__iexact='ADMINISTRADOR'):
        _, creado = RolPermiso.objects.using(alias).get_or_create(rol_id=rol.pk, permiso=permiso)
        if not creado:
            continue
        cuentas = Cuenta.objects.using(alias).filter(rol_id=rol.pk).values_list('pk', flat=True)
        for cuenta_id in cuentas:
            version, nueva = PermisosVersion.objects.using(alias).get_or_create(
                cuenta_id=cuenta_id, defaults={'version': 2},
            )
            if not nueva:
                version.version = F('version') + 1
                version.save(using=alias, update_fields=['version', 'updated_at'])


class Migration(migrations.Migration):
    dependencies = [
        ('identidad', '0016_seed_roles_captacion'),
    ]

    operations = [
        migrations.RunPython(aplicar, migrations.RunPython.noop),
    ]
