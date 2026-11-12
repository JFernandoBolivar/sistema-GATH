"""OC: el rol del actor se resuelve al registrar y se completa en filas viejas."""
import pytest
from django.core.management import call_command

from apps.auditoria.domain.value_objects.filtros_auditoria import FiltrosAuditoria
from apps.auditoria.infrastructure.repositories.repo_auditoria_orm import RepoAuditoriaORM
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog
from core.presentation.audit import registrar_auditoria

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _resolutor_de_rol_registrado():
    """El lector real de roles lo registra `AppConfig.ready()`; lo reponemos por si
    otro test llamó a `reiniciar_proveedores()` antes en el mismo proceso."""
    from apps.identidad.infrastructure.providers.resolutor_rol_actor import (
        ResolutorRolActorORM,
    )
    from core.infrastructure.providers import registrar_resolutor_rol_actor

    registrar_resolutor_rol_actor(ResolutorRolActorORM())


def _empleado(cedula: str) -> EmployeeModel:
    NacionalidadModel.objects.get_or_create(
        id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'},
    )
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='M')
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres='ANA', apellidos='PRUEBA', sexoid=sexo,
        nacionalidad_id=1,
    )


def _cuenta(cedula: str, rol: RolModel) -> CuentaModel:
    return CuentaModel.objects.create_user(cedula=_empleado(cedula), password=None, rol=rol)


def _rol(codigo: str, visible: str | None) -> RolModel:
    return RolModel.objects.create(nombre_rol=codigo, nombre_visible=visible)


def test_registro_nuevo_sin_rol_toma_el_nombre_visible():
    cuenta = _cuenta('10000001', _rol('ADMIN', 'Administrador del sistema'))

    registro = registrar_auditoria(
        trace_id='t1', actor_id=cuenta.pk, actor_cedula='10000001', actor_rol='',
        modulo='personal', accion='crear',
    )

    assert registro.actor_rol == 'Administrador del sistema'


def test_registro_sin_etiqueta_visible_usa_el_codigo_del_rol():
    cuenta = _cuenta('10000002', _rol('ANALISTA', None))

    registro = registrar_auditoria(
        trace_id='t2', actor_id=cuenta.pk, actor_cedula='10000002', actor_rol='',
        modulo='personal', accion='crear',
    )

    assert registro.actor_rol == 'ANALISTA'


def test_la_cadena_verifica_con_el_rol_resuelto():
    cuenta = _cuenta('10000003', _rol('ADMIN', 'Administrador del sistema'))
    for trace in ('t1', 't2'):
        registrar_auditoria(
            trace_id=trace, actor_id=cuenta.pk, actor_cedula='10000003', actor_rol='',
            modulo='personal', accion='crear',
        )

    # No lanza: cada hash incluye el actor_rol ya resuelto.
    call_command('verificar_cadena_auditoria')


def test_listado_completa_el_rol_de_filas_viejas_sin_n_mas_uno(django_assert_max_num_queries):
    rol = _rol('ADMIN', 'Administrador del sistema')
    primera = _cuenta('10000004', rol)
    segunda = _cuenta('10000005', rol)
    viejas = [
        AuditoriaLog.objects.create(
            trace_id=f'old{i}', actor_id=cuenta.pk, actor_cedula=cuenta.cedula_id,
            actor_rol='', modulo='personal', accion='vieja',
        )
        for i, cuenta in enumerate((primera, segunda), start=1)
    ]
    nueva = registrar_auditoria(
        trace_id='nueva', actor_id=primera.pk, actor_cedula='10000004', actor_rol='',
        modulo='personal', accion='nueva',
    )
    assert nueva.actor_rol == 'Administrador del sistema'

    with django_assert_max_num_queries(6):
        registros, total = RepoAuditoriaORM().listar(FiltrosAuditoria(), 10, 0)

    assert total == 3
    por_accion = {r.accion: r for r in registros if r.accion != 'vieja'}
    viejas_leidas = [r for r in registros if r.accion == 'vieja']
    assert len(viejas_leidas) == 2
    for registro in viejas_leidas:
        assert registro.actor_rol == ''
        assert registro.actor_rol_visible == 'Administrador del sistema'
        assert registro.actor_rol_actual is True
    assert por_accion['nueva'].actor_rol_actual is False

    detalle = RepoAuditoriaORM().obtener(str(viejas[0].pk))
    assert detalle.actor_rol_visible == 'Administrador del sistema'
    assert detalle.actor_rol_actual is True
