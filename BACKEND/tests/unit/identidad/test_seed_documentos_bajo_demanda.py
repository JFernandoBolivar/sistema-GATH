"""N-4: el permiso `documentos.generar_bajo_demanda` se siembra y lo recibe ADMINISTRADOR (solo él)."""
import importlib
from io import StringIO
from types import SimpleNamespace

import pytest
from django.apps import apps
from django.core.management import call_command
from django.db import connection

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel
from apps.identidad.infrastructure.models.permisos_version_model import PermisosVersionModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

PERMISO = 'documentos.generar_bajo_demanda'


def _roles_con_el_permiso() -> set[str]:
    ids = RolPermisoModel.objects.filter(permiso__codigo=PERMISO).values_list('rol_id', flat=True)
    return set(RolModel.objects.filter(pk__in=ids).values_list('nombre_rol', flat=True))


@pytest.fixture
def administrador(db):
    # Las pruebas corren sin migraciones: el rol 1 (ADMINISTRADOR) lo crea la base real, no el seed.
    for rol_id, nombre in ((1, 'ADMINISTRADOR'), (2, 'ANALISTA'), (5, 'BIENESTAR SOCIAL')):
        RolModel.objects.create(id=rol_id, nombre_rol=nombre)
    with connection.cursor() as c:  # los roles que crea el seed usan la secuencia: que no choque con los ids a mano
        c.execute("SELECT setval(pg_get_serial_sequence('\"USER_rol\"', 'id'), 100)")


@pytest.mark.django_db
def test_el_permiso_nuevo_se_siembra_para_administrador_y_para_nadie_mas(administrador):
    call_command('seed_permisos', stdout=StringIO())
    assert PermisoModel.objects.filter(codigo=PERMISO).exists()
    assert _roles_con_el_permiso() == {'ADMINISTRADOR'}


@pytest.mark.django_db
def test_la_migracion_de_datos_de_identidad_es_idempotente(administrador):
    migracion = importlib.import_module('apps.identidad.migrations.0017_seed_documentos_bajo_demanda')
    editor = SimpleNamespace(connection=connection)
    migracion.aplicar(apps, editor)
    migracion.aplicar(apps, editor)
    assert _roles_con_el_permiso() == {'ADMINISTRADOR'}
    assert RolPermisoModel.objects.filter(permiso__codigo=PERMISO).count() == 1


@pytest.mark.django_db
def test_la_asignacion_explicita_incrementa_la_version_de_las_cuentas_del_rol(administrador, monkeypatch):
    # Se aísla la asignación explícita: el seed completo también invalida permisos
    # cuando actualiza la matriz y esa prueba ya se cubre por separado.
    PermisoModel.objects.create(codigo=PERMISO, nombre='Generar documentos bajo demanda')
    nacionalidad = NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'},
    )[0]
    sexo = SexoModel.objects.create(sexo='M')
    empleado = EmployeeModel.objects.create(
        cedulaidentidad='12345678', nombres='ANA', apellidos='PEREZ', sexoid=sexo, nacionalidad=nacionalidad,
    )
    cuenta = CuentaModel.objects.create(cedula=empleado, rol_id=1)
    PermisosVersionModel.objects.create(cuenta_id=cuenta.pk, version=3)

    migracion = importlib.import_module('apps.identidad.migrations.0017_seed_documentos_bajo_demanda')
    monkeypatch.setattr(migracion, 'call_command', lambda *args, **kwargs: None)
    editor = SimpleNamespace(connection=connection)
    migracion.aplicar(apps, editor)
    migracion.aplicar(apps, editor)

    assert _roles_con_el_permiso() == {'ADMINISTRADOR'}
    assert PermisosVersionModel.objects.get(cuenta_id=cuenta.pk).version == 4
