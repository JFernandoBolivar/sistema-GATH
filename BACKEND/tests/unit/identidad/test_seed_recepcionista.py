"""RECEPCIONISTA: solo consulta familiares de activos y pasivos."""
from io import StringIO

import pytest
from django.core.management import call_command

from apps.identidad.infrastructure.models.cuenta_models import RolModel
from apps.identidad.infrastructure.models.permiso_model import RolPermisoModel

pytestmark = pytest.mark.django_db


def test_seed_crea_recepcionista_sin_permisos_de_escritura():
    call_command(
        "seed_permisos",
        "--no-invalidar-sesiones",
        stdout=StringIO(),
        stderr=StringIO(),
    )

    rol = RolModel.objects.get(nombre_rol="RECEPCIONISTA")
    codigos = set(
        RolPermisoModel.objects.filter(rol_id=rol.pk).values_list(
            "permiso__codigo", flat=True
        )
    )

    # Consulta de familiares de activos y pasivos.
    assert {"personal.ver", "personal.ver_detalle", "pasivos.ver", "familiares.ver"} <= codigos
    assert not ({"catalogos.ver", "organizacion.ver", "autogestion.ver_propio"} & codigos)

    # Nada de registrar, actualizar ni exportar.
    prohibidos = {
        "familiares.crear",
        "familiares.editar",
        "personal.crear",
        "personal.editar_personales",
        "personal.editar_laborales",
        "personal.exportar_pdf",
        "pasivos.editar",
        "pasivos.exportar_pdf",
    }
    assert not (codigos & prohibidos), codigos & prohibidos
