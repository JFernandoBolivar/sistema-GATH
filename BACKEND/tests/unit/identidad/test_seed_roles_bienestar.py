"""Seed de permisos y roles de Bienestar/Pasivo (Etapa A4): idempotente y con la matriz esperada."""
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command

from apps.identidad.infrastructure.models.cuenta_models import RolModel
from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel
from apps.identidad.management.commands.seed_permisos import PERMISOS_CATALOGO, PERMISOS_RETIRADOS, ROLES_NUEVOS

PERMISO_AVISOS_MOVIMIENTOS = 'personal.recibir_avisos_movimientos'


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
def test_matriz_de_bienestar_una_sola_persona_aprueba_la_autogestion():
    _seed()
    analista = _codigos('ANALISTA_BIENESTAR')
    admin = _codigos('ADMIN_BIENESTAR')

    aprobacion = {
        'bienestar.aprobar', 'bienestar.habilitar_ventana', 'bienestar.prorrogar_ventana',
        'bienestar.revisar_actualizacion', 'bienestar.ver_solicitudes',
    }
    # Autogestión: Analista y Administradora tienen el MISMO permiso de aprobación (una sola persona).
    assert aprobacion <= analista and aprobacion <= admin
    assert {'fe_de_vida.check_analista', 'fe_de_vida.revisar'} <= analista
    # La fe de vida conserva el doble check: la Analista nunca aprueba directo ni da el check de la Administradora.
    assert not analista & {'fe_de_vida.aprobar_directo', 'fe_de_vida.check_administradora'}
    assert {
        'fe_de_vida.check_administradora', 'fe_de_vida.aprobar_directo',
        'fe_de_vida.configurar_plantilla', 'bienestar.configurar_secciones',
    } <= admin
    assert not admin & {'fe_de_vida.check_analista'}
    assert {'notificaciones.ver_propias', 'personal.ver_salud', 'autogestion.ver_propio'} <= analista & admin
    # Permisos obsoletos de la doble aprobación en autogestión: ya no existen.
    for obsoleto in PERMISOS_RETIRADOS:
        assert obsoleto not in analista | admin
        assert not PermisoModel.objects.filter(codigo=obsoleto).exists()


@pytest.mark.django_db
def test_seed_retira_los_permisos_obsoletos_ya_asignados():
    rol = RolModel.objects.create(id=13, nombre_rol='ANALISTA_BIENESTAR')
    viejo = PermisoModel.objects.create(codigo='bienestar.check_analista', nombre='viejo')
    RolPermisoModel.objects.create(rol_id=rol.id, permiso=viejo)
    salida = _seed()
    assert 'Permiso obsoleto retirado: bienestar.check_analista' in salida
    assert not PermisoModel.objects.filter(codigo='bienestar.check_analista').exists()
    assert 'Permiso obsoleto retirado' not in _seed()  # idempotente


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


@pytest.mark.django_db
def test_gestionar_procesos_y_prorrogar_son_solo_de_la_administradora_y_el_seed_los_retira_de_la_analista():
    analista = RolModel.objects.create(id=13, nombre_rol='ANALISTA_BIENESTAR')
    for codigo in ('fe_de_vida.gestionar_procesos', 'fe_de_vida.prorrogar'):  # asignación heredada de un seed anterior
        permiso = PermisoModel.objects.create(codigo=codigo, nombre=codigo)
        RolPermisoModel.objects.create(rol_id=analista.id, permiso=permiso)
    salida = _seed()
    assert 'Asignaciones retiradas de ANALISTA_BIENESTAR: 2' in salida
    assert 'Asignaciones retiradas' not in _seed()  # idempotente
    nuevos = {'fe_de_vida.gestionar_procesos', 'fe_de_vida.prorrogar'}
    assert not nuevos & _codigos('ANALISTA_BIENESTAR')
    assert {'fe_de_vida.revisar', 'fe_de_vida.ver_panel', 'fe_de_vida.ver_cobertura'} <= _codigos('ANALISTA_BIENESTAR')
    assert nuevos <= _codigos('ADMIN_BIENESTAR')


@pytest.mark.django_db
def test_los_avisos_de_movimientos_son_solo_de_rrhh_y_bienestar():
    """G12-9: el ADMINISTRADOR conserva el catálogo menos este permiso."""
    for rol_id, nombre in ((1, 'ADMINISTRADOR'), (2, 'ANALISTA'), (5, 'BIENESTAR SOCIAL')):
        RolModel.objects.create(id=rol_id, nombre_rol=nombre)

    _seed()

    assert PERMISO_AVISOS_MOVIMIENTOS not in _codigos('ADMINISTRADOR')
    for rol in ('ANALISTA', 'BIENESTAR SOCIAL', 'ADMIN_BIENESTAR', 'ANALISTA_BIENESTAR'):
        assert PERMISO_AVISOS_MOVIMIENTOS in _codigos(rol), rol


@pytest.mark.django_db
def test_el_seed_retira_los_avisos_de_movimientos_al_administrador():
    """G12-9: idempotente; una asignación heredada del ADMINISTRADOR se elimina."""
    admin = RolModel.objects.create(id=1, nombre_rol='ADMINISTRADOR')
    permiso = PermisoModel.objects.create(
        codigo=PERMISO_AVISOS_MOVIMIENTOS, nombre='avisos de movimientos'
    )
    RolPermisoModel.objects.create(rol_id=admin.id, permiso=permiso)

    salida = _seed()

    assert 'Asignaciones retiradas de ADMINISTRADOR: 1' in salida
    assert PERMISO_AVISOS_MOVIMIENTOS not in _codigos('ADMINISTRADOR')
    assert 'Asignaciones retiradas de ADMINISTRADOR' not in _seed()


@pytest.mark.django_db
def test_auditoria_queda_en_administrador_y_en_el_rol_auditor():
    """D10: los tres códigos de auditoría y el rol AUDITOR nuevo."""
    for rol_id, nombre in ((1, 'ADMINISTRADOR'), (2, 'ANALISTA')):
        RolModel.objects.create(id=rol_id, nombre_rol=nombre)

    _seed()

    permisos_auditoria = {
        'auditoria.ver_logs',
        'auditoria.exportar',
        'auditoria.ver_seguridad',
    }
    assert permisos_auditoria <= _codigos('ADMINISTRADOR')
    assert RolModel.objects.filter(nombre_rol='AUDITOR').exists()
    assert permisos_auditoria <= _codigos('AUDITOR')
    assert 'notificaciones.ver_propias' in _codigos('AUDITOR')
    assert not permisos_auditoria & _codigos('ANALISTA')
