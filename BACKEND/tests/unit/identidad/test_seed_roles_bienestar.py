"""Seed de permisos y roles de Bienestar/Pasivo (Etapa A4): idempotente y con la matriz esperada."""
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command

from apps.identidad.infrastructure.models.cuenta_models import RolModel
from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel
from apps.identidad.management.commands.seed_permisos import PERMISOS_CATALOGO, ROLES_NUEVOS


def _seed():
    out = StringIO()
    call_command('seed_permisos', stdout=out)
    return out.getvalue()


def _codigos(nombre_rol):
    rol = RolModel.objects.get(nombre_rol=nombre_rol)
    return set(
        RolPermisoModel.objects.filter(rol_id=rol.id).values_list('permiso__codigo', flat=True)
    )


@pytest.mark.django_db
def test_seed_crea_roles_y_permisos_y_es_idempotente():
    _seed()
    estado1 = (
        PermisoModel.objects.count(),
        RolModel.objects.count(),
        RolPermisoModel.objects.count(),
    )
    segunda = _seed()
    estado2 = (
        PermisoModel.objects.count(),
        RolModel.objects.count(),
        RolPermisoModel.objects.count(),
    )
    assert estado1 == estado2
    assert 'Total nuevas asignaciones: 0' in segunda
    assert 'Roles nuevos creados: 0' in segunda
    assert set(ROLES_NUEVOS) <= set(RolModel.objects.values_list('nombre_rol', flat=True))
    assert PermisoModel.objects.count() >= len(PERMISOS_CATALOGO)


@pytest.mark.django_db
def test_matriz_de_bienestar_respeta_el_doble_check():
    _seed()
    analista = _codigos('ANALISTA_BIENESTAR')
    admin = _codigos('ADMIN_BIENESTAR')

    assert {'fe_de_vida.check_analista', 'bienestar.check_analista', 'fe_de_vida.revisar'} <= analista
    # La Analista nunca aprueba directo ni da el check de la Administradora.
    assert not analista & {
        'fe_de_vida.aprobar_directo', 'bienestar.aprobar_directo',
        'fe_de_vida.check_administradora', 'bienestar.check_administradora',
    }
    assert {
        'fe_de_vida.check_administradora', 'fe_de_vida.aprobar_directo',
        'bienestar.aprobar_directo', 'bienestar.habilitar_ventana',
        'fe_de_vida.configurar_plantilla', 'bienestar.configurar_secciones',
    } <= admin
    # La Administradora no da el check de la Analista: el doble check exige dos personas.
    assert not admin & {'fe_de_vida.check_analista', 'bienestar.check_analista'}
    assert {'notificaciones.ver_propias', 'personal.ver_salud'} <= analista & admin


@pytest.mark.django_db
def test_no_existe_rol_pasivo_y_autogestion_tiene_fe_de_vida_propia():
    RolModel.objects.create(id=3, nombre_rol='AUTOGESTION')
    _seed()
    assert not RolModel.objects.filter(nombre_rol='PASIVO').exists()
    autogestion = _codigos('AUTOGESTION')
    assert {
        'fe_de_vida.solicitar', 'fe_de_vida.ver_propia',
        'autogestion.subir_soporte', 'notificaciones.ver_propias',
    } <= autogestion
    assert not any(c.startswith(('carnetizacion.', 'personal.', 'bienestar.')) for c in autogestion)


@pytest.mark.django_db
def test_seed_sube_permisos_version_solo_si_la_matriz_cambio():
    RolModel.objects.create(id=3, nombre_rol='AUTOGESTION')
    ruta = 'apps.identidad.management.commands.seed_permisos.RepoPermisosVersionORM.incrementar_por_rol'

    with patch(ruta, return_value=1) as bump:
        _seed()
    assert 3 in [c.args[0] for c in bump.call_args_list]  # AUTOGESTION ganó permisos nuevos
    assert 'autogestion.solicitar_actualizacion' in _codigos('AUTOGESTION')

    with patch(ruta, return_value=1) as bump:
        _seed()
    bump.assert_not_called()  # matriz sin cambios: no se invalidan sesiones

    with patch(ruta, return_value=1) as bump:
        call_command('seed_permisos', '--no-invalidar-sesiones', stdout=StringIO())
    bump.assert_not_called()
