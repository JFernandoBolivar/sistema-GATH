"""Siembra `personal.editar_nacionalidad` y la agrega (solo agregar) a quien ya editaba la nacionalidad.

Hasta ahora la nacionalidad se editaba con `personal.editar_personales` (activos) o
`pasivos.editar` (pasivos). Para no romperle el trabajo a nadie, todo rol que tenga alguno de
esos dos permisos recibe también el nuevo. ADMINISTRADOR lo recibe por el seed del catálogo.
Nunca se quita nada.
"""
from django.core.management import call_command
from django.db import migrations

PERMISO = 'personal.editar_nacionalidad'
PERMISOS_PREVIOS = ('personal.editar_personales', 'pasivos.editar')


def aplicar(apps, schema_editor):
    call_command('seed_permisos')

    from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel
    from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import RepoPermisosVersionORM

    nuevo = PermisoModel.objects.filter(codigo=PERMISO).first()
    if nuevo is None:
        return
    roles = set(
        RolPermisoModel.objects.filter(permiso__codigo__in=PERMISOS_PREVIOS).values_list('rol_id', flat=True)
    )
    modificados = []
    for rol_id in sorted(roles):
        _, creado = RolPermisoModel.objects.get_or_create(rol_id=rol_id, permiso=nuevo)
        if creado:
            modificados.append(rol_id)
    if modificados:
        repo = RepoPermisosVersionORM()
        for rol_id in modificados:
            repo.incrementar_por_rol(rol_id)


class Migration(migrations.Migration):
    dependencies = [
        ('identidad', '0013_seed_corregir_cedula'),
    ]

    operations = [
        migrations.RunPython(aplicar, migrations.RunPython.noop),
    ]
