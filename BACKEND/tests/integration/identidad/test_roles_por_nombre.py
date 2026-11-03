"""Roles por nombre: los IDs de una base heredada no deben romper el arranque."""
from io import StringIO

import pytest
from django.core.management import call_command

from apps.identidad.infrastructure.models.cuenta_models import RolModel
from apps.identidad.infrastructure.models.permiso_model import RolPermisoModel
from apps.identidad.management.commands.crear_usuarios_qa import Command as CrearUsuariosQA

pytestmark = pytest.mark.django_db


def _crear_roles_base():
    for nombre in (
        "ADMINISTRADOR",
        "ANALISTA",
        "AUTOGESTION",
        "PRESUPUESTO",
        "BIENSTAR SOCIAL",
    ):
        RolModel.objects.create(nombre_rol=nombre)


def test_rol_por_nombre_resuelve_el_id_real():
    _crear_roles_base()
    recepcionista = RolModel.objects.create(nombre_rol="RECEPCIONISTA")
    admin_bienestar = RolModel.objects.create(nombre_rol="ADMIN_BIENESTAR")
    bienestar = RolModel.objects.get(nombre_rol="BIENSTAR SOCIAL")

    comando = CrearUsuariosQA()
    assert comando._rol_por_nombre("ADMIN_BIENESTAR").pk == admin_bienestar.pk
    assert comando._rol_por_nombre("BIENESTAR SOCIAL").pk == bienestar.pk
    assert comando._rol_por_nombre("BIENSTAR SOCIAL").pk == bienestar.pk
    assert recepcionista.pk != 9


def test_migrar_roles_no_aborta_si_recepcionista_tiene_otro_id():
    """Regresión QA: el comando exigía el rol 9 y abortaba el bootstrap."""
    _crear_roles_base()
    recepcionista = RolModel.objects.create(nombre_rol="RECEPCIONISTA")
    assert recepcionista.pk != 9

    call_command("migrar_roles_legados", stdout=StringIO(), stderr=StringIO())


def test_seed_aplica_permisos_a_recepcionista_con_id_distinto():
    _crear_roles_base()
    recepcionista = RolModel.objects.create(nombre_rol="RECEPCIONISTA")
    assert recepcionista.pk != 9

    call_command(
        "seed_permisos",
        "--no-invalidar-sesiones",
        stdout=StringIO(),
        stderr=StringIO(),
    )

    assert RolPermisoModel.objects.filter(rol_id=recepcionista.pk).count() > 0
