"""U2-bis: selección barata de cuentas con clave inicial (sin rehash si hay fila)."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel
from apps.identidad.infrastructure.repositories.repo_cuentas_clave_inicial_orm import (
    RepoCuentasClaveInicialORM,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
pytestmark = pytest.mark.django_db


def _empleado(cedula: str) -> EmployeeModel:
    NacionalidadModel.objects.get_or_create(
        id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'},
    )
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='M')
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres='PRUEBA', apellidos=cedula, sexoid=sexo,
        nacionalidad_id=1,
    )


def _fila(cuenta, ahora):
    PasswordInicialModel.objects.create(
        cuenta_id=cuenta.pk, emitida_en=ahora, vence_en=ahora + timedelta(days=7),
    )


def test_con_clave_inicial_usa_solo_la_fila_sin_comparar_hashes():
    ahora = timezone.now()
    # Con fila: entra (la fila se borra al cambiar la clave).
    con_fila = CuentaModel.objects.create_user(cedula=_empleado('10000001'), password='10000001')
    _fila(con_fila, ahora)
    # Sin fila: no entra aunque la clave sea la cédula (no vence, puede ingresar).
    sin_fila = CuentaModel.objects.create_user(cedula=_empleado('10000002'), password='10000002')
    # Con fila pero desactivada: no entra.
    inactiva = CuentaModel.objects.create_user(cedula=_empleado('10000003'), password='10000003')
    _fila(inactiva, ahora)
    inactiva.is_active = False
    inactiva.save(update_fields=['is_active'])

    ids = {c.cuenta_id for c in RepoCuentasClaveInicialORM().con_clave_inicial()}
    assert con_fila.pk in ids
    assert sin_fila.pk not in ids
    assert inactiva.pk not in ids


def test_la_vista_previa_cachea_la_lista_de_ids():
    """U2-bis: la tarea de preview deja la lista para la ejecución."""
    from django.core.cache import cache

    from apps.identidad.infrastructure.tasks.restablecer_acceso_bloque_tasks import (
        clave_preview,
        restablecimiento_bloque_preview_tarea,
    )

    primera = CuentaModel.objects.create_user(cedula=_empleado('10000011'), password='10000011')
    segunda = CuentaModel.objects.create_user(cedula=_empleado('10000012'), password='10000012')
    _fila(primera, timezone.now())
    _fila(segunda, timezone.now())
    actor = {'cuenta_id': 77, 'rol_id': None, 'cedula': '30799436'}

    resultado = restablecimiento_bloque_preview_tarea.apply(
        args=['AMBOS', 'SIN_PRIMER_INGRESO', True, 'Claves vencidas del personal', actor],
    ).get()

    assert resultado['estado'] == 'LISTO'
    assert resultado['total'] == 2
    ids = cache.get(clave_preview(77, 'AMBOS', 'SIN_PRIMER_INGRESO'))
    assert set(ids) == {primera.pk, segunda.pk}
    cache.delete(clave_preview(77, 'AMBOS', 'SIN_PRIMER_INGRESO'))

