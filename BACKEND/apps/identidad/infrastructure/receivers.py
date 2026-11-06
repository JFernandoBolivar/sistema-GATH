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
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.cargos.domain.events import cargo_movimiento_ejecutado
from apps.identidad.application.use_cases.aprovisionar_cuenta_trabajador import (
    aprovisionar_cuenta_trabajador,
)
from apps.identidad.application.use_cases.desactivar_cuenta_por_egreso import (
    desactivar_cuenta_por_egreso,
)
from apps.identidad.application.use_cases.reactivar_cuenta_por_reingreso import (
    reactivar_cuenta_por_reingreso,
)
from apps.identidad.domain.services.notificaciones_eventos import solicitud_de_evento
from apps.identidad.domain.services.politica_movimientos import (
    es_movimiento_de_egreso,
    es_movimiento_de_ingreso,
)
from apps.identidad.domain.services.politica_password_inicial import (
    DIAS_VIGENCIA_PASSWORD_INICIAL,
)
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_correo_acceso_orm import RepoCorreoAccesoORM
from apps.identidad.infrastructure.repositories.repo_desactivacion_egreso_orm import (
    RepoDesactivacionEgresoORM,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.identidad.infrastructure.signals import (
    evento_identidad_en_transaccion,
    publicar_evento_identidad,
)
from apps.catalogos.infrastructure.models.catalogo_models import TipoMovimientoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.configuracion import CLAVE_AVISAR_CUENTA_CREADA_POR_CORREO, CLAVE_PASSWORD_INICIAL_DIAS
from core.infrastructure.providers import obtener_lector_configuracion, obtener_notificador

logger = logging.getLogger('gath.identidad')


def aprovisionar_por_cedula(cedula: str, permitir_pasivo: bool = False):
    """Alta automática de la cuenta de `cedula` si corresponde (idempotente)."""
    if RepoCuentasORM().existe_cuenta_para_cedula(cedula):
        return None
    try:
        from apps.configuracion.domain.correo_acceso import (
            DatosCorreoTrabajador,
            resolver_correo_para_trabajador,
        )
        from apps.configuracion.infrastructure.repositories.repo_politica_correo_acceso_orm import (
            RepoPoliticaCorreoAccesoORM,
        )
        repo_cond = RepoCondicionTrabajadorORM()
        cond = repo_cond.condicion_por_cedula(cedula)
        es_pasivo = (cond is CondicionTrabajador.PASIVO)

        if es_pasivo and not permitir_pasivo:
            return None

        repo_corr = RepoCorreoAccesoORM()
        correo_ficha = repo_corr.correo_de(cedula)
        # El alternativo no es login: sin correo principal no hay cuenta y nunca se escribe
        # `Employee.correo` a partir del alternativo (FIX-AUD8).
        if not correo_ficha:
            return None
        correo_alt = repo_corr.correo_alternativo_de(cedula)
        dom_inst = getattr(settings, 'DOMINIO_CORREO_INSTITUCIONAL', '@conatel.gob.ve')
        correo_inst = correo_ficha if dom_inst in correo_ficha.lower() else ''

        politica_repo = RepoPoliticaCorreoAccesoORM()
        politica = politica_repo.obtener_politica()
        excepciones = politica_repo.listar_cedulas_excepcion()

        datos = DatosCorreoTrabajador(
            cedula=str(cedula),
            nombre_completo='',
            condicion='PASIVO' if es_pasivo else 'ACTIVO',
            correo_actual_acceso=correo_ficha,
            correo_institucional=correo_inst,
            correo_alternativo=correo_alt,
            correo_ficha=correo_ficha,
            tiene_cuenta=False,
            es_excepcion_manual=(str(cedula) in excepciones),
        )
        correo_resuelto = resolver_correo_para_trabajador(datos, politica)
        if not correo_resuelto:
            return None

    except Exception:
        logger.exception('no se pudo evaluar la política de correo de acceso para %s', cedula)

    lector = obtener_lector_configuracion()
    dias = (
        lector.obtener_entero(CLAVE_PASSWORD_INICIAL_DIAS)
        if lector is not None else DIAS_VIGENCIA_PASSWORD_INICIAL
    )
    return aprovisionar_cuenta_trabajador(
        RepoCuentasORM(), RepoCorreoAccesoORM(), RepoCondicionTrabajadorORM(), RepoPasswordInicialORM(),
        publicar_evento_identidad, cedula, settings.DOMINIO_CORREO_INSTITUCIONAL, timezone.now(),
        permitir_pasivo=permitir_pasivo, dias_vigencia=dias,
    )


def aprovisionar_eligiendo_correo(cedula: str):
    """Variante del endpoint `correo-acceso`: aquí sí se crea la cuenta del pasivo o sobreviviente."""
    return aprovisionar_por_cedula(cedula, permitir_pasivo=True)


def _categoria_del_motivo(motivo_id) -> str | None:
    if not motivo_id:
        return None
    return (
        TipoMovimientoModel.objects.filter(pk=motivo_id).values_list('categoria__categoria', flat=True).first()
    )


def _aplicar_ciclo_de_vida(cedula: str, egreso: bool, ingreso: bool) -> None:
    """Corre al CONFIRMAR la transacción del movimiento: ahí la condición ya es la definitiva."""
    try:
        with transaction.atomic():
            if egreso:
                desactivar_cuenta_por_egreso(
                    RepoCuentasORM(), RepoCondicionTrabajadorORM(), RepoDesactivacionEgresoORM(), cedula
                )
            elif ingreso:
                reactivar_cuenta_por_reingreso(
                    RepoCuentasORM(), RepoCondicionTrabajadorORM(), RepoDesactivacionEgresoORM(), cedula
                )
                if RepoCondicionTrabajadorORM().condicion_por_cedula(cedula) is CondicionTrabajador.ACTIVO:
                    aprovisionar_por_cedula(cedula)
            # Egreso / pase a pasivo / reingreso: el contexto de autenticación
            # cacheado deja de ser válido aunque la cuenta no cambie de rol.
            RepoCuentasORM().invalidar_contexto_por_cedula(cedula)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo aplicar el ciclo de vida de la cuenta de %s', cedula)


@receiver(evento_identidad_en_transaccion, dispatch_uid='identidad_notificar_evento')
def notificar_evento_identidad(sender, evento, **kwargs):
    notificador = obtener_notificador()
    if notificador is None:
        logger.warning('sin Notificador registrado: el evento %s no genera avisos', evento.tipo.value)
        return
    try:
        lector = obtener_lector_configuracion()
        avisar = lector.obtener_booleano(CLAVE_AVISAR_CUENTA_CREADA_POR_CORREO) if lector is not None else False
        solicitud = solicitud_de_evento(evento, avisar_cuenta_creada_por_correo=avisar)
        if solicitud is not None:
            with transaction.atomic():
                notificador.notificar(solicitud)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo generar el aviso del evento %s', evento.tipo.value)


@receiver(post_save, sender=CuentaModel, dispatch_uid='identidad_contexto_cuenta_guardada')
def invalidar_contexto_al_guardar_cuenta(sender, instance, **kwargs):
    """Cualquier cambio de cuenta (rol, estado, contraseña) invalida L-NEW2."""
    try:
        RepoCuentasORM().invalidar_contexto_cuenta(instance.pk)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo invalidar el contexto de la cuenta %s', instance.pk)


@receiver(post_delete, sender=CuentaModel, dispatch_uid='identidad_contexto_cuenta_borrada')
def invalidar_contexto_al_borrar_cuenta(sender, instance, **kwargs):
    try:
        RepoCuentasORM().invalidar_contexto_cuenta(instance.pk)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo invalidar el contexto de la cuenta borrada %s', instance.pk)


@receiver(post_save, sender=EmployeeModel, dispatch_uid='identidad_alta_cuenta_por_correo')
def alta_de_cuenta_al_cargar_correo(sender, instance, **kwargs):
    if not (instance.correo or '').strip():
        return
    try:
        with transaction.atomic():
            # RRHH asignó un correo en Gestión de Trabajadores: activo o pasivo, la cuenta se crea ya
            # (idempotente: si ya existe no hace nada).
            aprovisionar_por_cedula(str(instance.cedulaidentidad), permitir_pasivo=True)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo evaluar el alta de cuenta de %s', instance.cedulaidentidad)


@receiver(cargo_movimiento_ejecutado, dispatch_uid='identidad_ciclo_de_vida_por_movimiento')
def ciclo_de_vida_por_movimiento(sender, cedula=None, tipo_movimiento=None, motivo_id=None, **kwargs):
    """Solo un EGRESO real (por tipo o por la categoría del motivo) desactiva; solo un INGRESO reactiva.

    Traslados, préstamos, cambios de estatus y asignar/desasignar de un cargo nunca desactivan, aunque
    dejen al trabajador un instante sin asignación dentro de la transacción: la decisión se toma
    con `on_commit`, cuando la condición ya es la definitiva.
    """
    if not cedula:
        return
    cedula = str(cedula)
    try:
        egreso = es_movimiento_de_egreso(tipo_movimiento, _categoria_del_motivo(motivo_id))
        ingreso = es_movimiento_de_ingreso(tipo_movimiento)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudo clasificar el movimiento de %s', cedula)
        return
    if egreso or ingreso:
        transaction.on_commit(lambda: _aplicar_ciclo_de_vida(cedula, egreso, ingreso))
