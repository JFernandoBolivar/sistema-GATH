"""Invalidación de la caché de «Mi expediente» (L-01).

Se engancha a los modelos que componen el expediente y al evento de movimientos
de cargo. Así cualquier edición desde RRHH, cambio de familiar, movimiento,
egreso o pase a pasivo deja inaccesible la respuesta cacheada.
"""
import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.cargos.domain.events import cargo_movimiento_ejecutado
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.carnetizacion.infrastructure.models.carnetizacion_models import CarnetEmitidoModel
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

from .mi_expediente_cache import invalidar_mi_expediente

logger = logging.getLogger('gath.autogestion')


def _cedula_desde_empleado_id(empleado_id) -> str | None:
    if not empleado_id:
        return None
    return (
        EmployeeModel.objects.filter(pk=empleado_id)
        .values_list('cedulaidentidad', flat=True)
        .first()
    )


def _cedula_de(instance) -> str | None:
    if isinstance(instance, EmployeeModel):
        return instance.cedulaidentidad
    if isinstance(instance, EmployeefamilyModel):
        return instance.employeecedula_id
    if isinstance(instance, (AsigTrabajoModel, CarnetEmitidoModel)):
        return str(instance.employee_id) if instance.employee_id else None
    return _cedula_desde_empleado_id(getattr(instance, 'empleado_id', None))


def _invalidar(instance) -> None:
    try:
        from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
        if isinstance(instance, ParametroSistemaModel):
            if instance.clave.startswith('carnetizacion.mi_carnet'):
                # L2-17: la política de «Mi carnet» se lee en cada petición
                # (``repo_portal_trabajador_orm.puede_ver_carnet``), así que no hay
                # nada cacheado que borrar. Antes se hacía ``cache.clear()``, que
                # vaciaba también los contadores de throttling (login, QR...).
                return
        invalidar_mi_expediente(_cedula_de(instance))
    except Exception:  # noqa: BLE001 - una caché no debe tumbar la escritura
        logger.exception('no se pudo invalidar Mi expediente para %r', instance)


@receiver(post_save, dispatch_uid='autogestion_invalidar_mi_expediente_save')
def invalidar_al_guardar(sender, instance, **kwargs):
    _invalidar(instance)


@receiver(post_delete, dispatch_uid='autogestion_invalidar_mi_expediente_delete')
def invalidar_al_borrar(sender, instance, **kwargs):
    _invalidar(instance)


@receiver(cargo_movimiento_ejecutado, dispatch_uid='autogestion_invalidar_mi_expediente_movimiento')
def invalidar_por_movimiento(sender, cedula=None, **kwargs):
    try:
        invalidar_mi_expediente(str(cedula) if cedula else None)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo invalidar Mi expediente por movimiento de %s', cedula)
