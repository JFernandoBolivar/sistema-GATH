"""
Receivers de identidad (ciclo de vida de las cuentas, D8). Conectados en `IdentidadConfig.ready()`.

- `evento_identidad_en_transaccion` -> aviso por el puerto `Notificador` del kernel (sin importar
  `apps.notificaciones`).
- `post_save` de `Employee` -> alta automática de la cuenta cuando la ficha recibe un correo.
- `cargo_movimiento_ejecutado` (emitido por `apps.cargos` y por el pase a pasivo de `apps.pasivos`) ->
  alta del trabajador ACTIVO con correo institucional, o desactivación si ya no tiene ninguna asignación.
  No se importa nada de `apps.pasivos`: se escucha el evento existente.

Ningún fallo aquí debe tumbar la operación de negocio que lo originó: cada receptor aísla su trabajo en
un savepoint y registra el error.
"""
import logging

from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.cargos.domain.events import cargo_movimiento_ejecutado
from apps.identidad.application.use_cases.aprovisionar_cuenta_trabajador import (
    aprovisionar_cuenta_trabajador,
)
from apps.identidad.application.use_cases.desactivar_cuenta_por_egreso import (
    desactivar_cuenta_por_egreso,
)
from apps.identidad.domain.services.notificaciones_eventos import solicitud_de_evento
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_correo_acceso_orm import RepoCorreoAccesoORM
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.identidad.infrastructure.signals import (
    evento_identidad_en_transaccion,
    publicar_evento_identidad,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.providers import obtener_notificador

logger = logging.getLogger('gath.identidad')


def aprovisionar_por_cedula(cedula: str):
    """Alta automática de la cuenta de `cedula` si corresponde (idempotente)."""
    return aprovisionar_cuenta_trabajador(
        RepoCuentasORM(), RepoCorreoAccesoORM(), RepoCondicionTrabajadorORM(), RepoPasswordInicialORM(),
        publicar_evento_identidad, cedula, settings.DOMINIO_CORREO_INSTITUCIONAL, timezone.now(),
    )


@receiver(evento_identidad_en_transaccion, dispatch_uid='identidad_notificar_evento')
def notificar_evento_identidad(sender, evento, **kwargs):
    notificador = obtener_notificador()
    if notificador is None:
        logger.warning('sin Notificador registrado: el evento %s no genera avisos', evento.tipo.value)
        return
    try:
        solicitud = solicitud_de_evento(evento)
        if solicitud is not None:
            with transaction.atomic():
                notificador.notificar(solicitud)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo generar el aviso del evento %s', evento.tipo.value)


@receiver(post_save, sender=EmployeeModel, dispatch_uid='identidad_alta_cuenta_por_correo')
def alta_de_cuenta_al_cargar_correo(sender, instance, **kwargs):
    if not (instance.correo or '').strip():
        return
    try:
        with transaction.atomic():
            aprovisionar_por_cedula(str(instance.cedulaidentidad))
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo evaluar el alta de cuenta de %s', instance.cedulaidentidad)


@receiver(cargo_movimiento_ejecutado, dispatch_uid='identidad_ciclo_de_vida_por_movimiento')
def ciclo_de_vida_por_movimiento(sender, cedula=None, **kwargs):
    if not cedula:
        return
    cedula = str(cedula)
    try:
        with transaction.atomic():
            condicion = RepoCondicionTrabajadorORM().condicion_por_cedula(cedula)
            if condicion is CondicionTrabajador.SIN_ASIGNACION:
                desactivar_cuenta_por_egreso(RepoCuentasORM(), RepoCondicionTrabajadorORM(), cedula)
            elif condicion is CondicionTrabajador.ACTIVO:
                # Un PASIVO no se evalúa aquí: su cuenta nace cuando RRHH elige/carga su correo.
                aprovisionar_por_cedula(cedula)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo aplicar el ciclo de vida de la cuenta de %s', cedula)
