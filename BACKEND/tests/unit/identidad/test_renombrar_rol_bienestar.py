"""B14: el renombre del rol 5 es idempotente, respalda antes y no pierde permisos."""
import json
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.identidad.infrastructure.models.cuenta_models import RolModel
from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel


def _correr(tmp_path, *extra):
    salida = StringIO()
    call_command('renombrar_rol_bienestar', '--respaldo-dir', str(tmp_path), *extra, stdout=salida)
    return salida.getvalue()


@pytest.fixture
def rol_con_permisos(db):
    rol = RolModel.objects.create(id=5, nombre_rol='BIENSTAR SOCIAL')
    for codigo in ('personal.ver', 'reportes.ver'):
        RolPermisoModel.objects.create(rol_id=rol.id, permiso=PermisoModel.objects.create(codigo=codigo, nombre=codigo))
    return rol


@pytest.mark.django_db
def test_renombra_respalda_y_conserva_los_permisos(tmp_path, rol_con_permisos):
    salida = _correr(tmp_path)
    assert RolModel.objects.get(pk=5).nombre_rol == 'BIENESTAR SOCIAL'
    assert RolPermisoModel.objects.filter(rol_id=5).count() == 2
    respaldos = list(tmp_path.glob('USER_rol_respaldo_*.json'))
    assert len(respaldos) == 1 and 'Respaldo:' in salida
    contenido = json.loads(respaldos[0].read_text(encoding='utf-8'))
    assert {'id': 5, 'nombre_rol': 'BIENSTAR SOCIAL', 'descripcion_rol': None} in contenido['filas']
    assert contenido['rol_permisos_del_rol'] == ['personal.ver', 'reportes.ver']


@pytest.mark.django_db
def test_es_idempotente(tmp_path, rol_con_permisos):
    _correr(tmp_path)
    segunda = _correr(tmp_path)
    assert 'Sin cambios' in segunda
    assert len(list(tmp_path.glob('USER_rol_respaldo_*.json'))) == 1  # no vuelve a respaldar ni a modificar


@pytest.mark.django_db
def test_dry_run_no_modifica(tmp_path, rol_con_permisos):
    assert 'dry-run' in _correr(tmp_path, '--dry-run')
    assert RolModel.objects.get(pk=5).nombre_rol == 'BIENSTAR SOCIAL'
    assert not list(tmp_path.glob('*.json'))


@pytest.mark.django_db
def test_rechaza_si_el_nombre_no_es_el_esperado(tmp_path, db):
    RolModel.objects.create(id=5, nombre_rol='OTRO')
    with pytest.raises(CommandError):
        _correr(tmp_path)
