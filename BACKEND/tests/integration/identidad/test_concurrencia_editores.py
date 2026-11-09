"""
M1: dos desactivaciones concurrentes no pueden dejar cero editores de la matriz.

El bloqueo `pg_advisory_xact_lock` de `RepoCuentasORM.bloquear_administracion`
serializa el conteo y el cambio; la segunda transacción ve el estado ya
confirmado por la primera y revierte con ConflictError.
"""
import concurrent.futures
import threading

import pytest
from django.db import connection, transaction

from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.identidad.application.use_cases.administrar_usuarios import contar_editores_matriz
from apps.identidad.domain.services.reglas_administracion import (
    exigir_al_menos_un_editor_matriz,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.permiso_model import (
    PermisoModel,
    RolPermisoModel,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_permisos_orm import RepoPermisosORM
from apps.identidad.infrastructure.models.permiso_model import PermisoModel as Permiso
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ConflictError

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def dos_editores(db):
    SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(
        id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'}
    )
    RolModel.objects.get_or_create(id=1, defaults={'nombre_rol': 'ADMINISTRADOR'})
    permiso, _ = Permiso.objects.get_or_create(
        codigo='identidad.asignar_permisos', defaults={'nombre': 'Matriz'}
    )
    RolPermisoModel.objects.get_or_create(rol_id=1, permiso=permiso)
    cuentas = []
    for cedula in ('56000001', '56000002'):
        empleado = EmployeeModel.objects.create(
            cedulaidentidad=cedula,
            nombres='CONCURRENCIA',
            apellidos='PRUEBA',
            sexoid_id=1,
            correo=f'{cedula}@conatel.gob.ve',
        )
        cuentas.append(
            CuentaModel.objects.create_user(cedula=empleado, password=cedula, rol_id=1)
        )
    return cuentas


def _desactivar(cuenta_id: int, barrera: threading.Barrier, resultados: list[str]) -> None:
    try:
        barrera.wait(timeout=10)
        with transaction.atomic():
            repo = RepoCuentasORM()
            repo.bloquear_administracion()
            antes = contar_editores_matriz(RepoPermisosORM())
            cuenta = repo.obtener_por_id(cuenta_id)
            repo.guardar(cuenta.desactivar())
            exigir_al_menos_un_editor_matriz(
                antes=antes,
                despues=contar_editores_matriz(RepoPermisosORM()),
            )
        resultados.append('ok')
    except ConflictError:
        resultados.append('conflicto')
    finally:
        connection.close()


def test_dos_desactivaciones_concurrentes_dejan_al_menos_un_editor(dos_editores):
    barrera = threading.Barrier(2)
    resultados: list[str] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futuros = [
            pool.submit(_desactivar, cuenta.pk, barrera, resultados)
            for cuenta in dos_editores
        ]
        for futuro in futuros:
            futuro.result(timeout=30)

    assert sorted(resultados) == ['conflicto', 'ok']
    assert contar_editores_matriz(RepoPermisosORM()) == 1
