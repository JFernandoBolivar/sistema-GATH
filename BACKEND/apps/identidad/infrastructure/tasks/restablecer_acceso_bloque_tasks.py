"""
Tareas U2: vista previa y ejecución del restablecimiento de acceso en bloque.

La vista previa es asíncrona: `check_password` (Argon2) tarda minutos y no cabe
en una petición HTTP. Guarda en caché, por actor/clasificación/alcance y 30
minutos, **la lista de `cuenta_id` elegidas**; la ejecución la reutiliza sin
volver a comprobar hashes.
"""
import logging
import uuid
from dataclasses import asdict

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.restablecer_acceso_en_bloque import (
    restablecer_acceso_en_bloque,
    seleccionar_cuentas,
)
from apps.identidad.domain.entities.restablecimiento_bloque import ResultadoRestablecimientoBloque
from apps.identidad.domain.value_objects.restablecimiento_bloque import Alcance, Clasificacion
from apps.identidad.infrastructure.providers.bloqueos_login import limpiar_bloqueo
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_clave_inicial_orm import (
    RepoCuentasClaveInicialORM,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.identidad.infrastructure.repositories.repo_permisos_orm import RepoPermisosORM
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.identidad.infrastructure.signals import publicar_evento_identidad
from core.domain.configuracion import CLAVE_PASSWORD_INICIAL_DIAS
from core.domain.exceptions import ConflictError
from core.infrastructure.providers import obtener_lector_configuracion
from core.presentation.audit import registrar_auditoria

logger = logging.getLogger('security_backend')

CANDADO = 'identidad:lock:restablecer_acceso_bloque'
CANDADO_SEGUNDOS = 2 * 60 * 60
PREVIEW_TTL = 30 * 60
ACCION_AUDITORIA = 'identidad.acceso_restablecido_bloque'
DIAS_POR_DEFECTO = 7


def clave_preview(actor_id, clasificacion: str, alcance: str) -> str:
    """Clave de caché compartida por la vista previa y la ejecución."""
    return f'identidad:preview_restablecimiento_bloque:{actor_id}:{clasificacion}:{alcance}'


@shared_task(name='identidad.restablecer_acceso_en_bloque_preview', acks_late=True)
def restablecimiento_bloque_preview_tarea(
    clasificacion: str,
    alcance: str,
    enviar_correo: bool,
    motivo: str,
    actor: dict,
) -> dict:
    """Selecciona las cuentas y deja la lista de ids en caché para la ejecución."""
    try:
        clasificacion_enum = Clasificacion(clasificacion)
        alcance_enum = Alcance(alcance)
    except ValueError as exc:
        return {'estado': 'ERROR', 'mensaje': str(exc)}

    seleccion = seleccionar_cuentas(
        RepoCondicionTrabajadorORM(),
        RepoPermisosORM(),
        RepoCuentasClaveInicialORM(),
        ActorSesionDTO(**actor),
        clasificacion_enum,
        alcance_enum,
    )
    cache.set(
        clave_preview(actor.get('cuenta_id'), clasificacion, alcance),
        list(seleccion.cuenta_ids),
        PREVIEW_TTL,
    )
    resultado = ResultadoRestablecimientoBloque(
        revisadas=seleccion.revisadas,
        activos=seleccion.activos,
        pasivos=seleccion.pasivos,
        total=len(seleccion.cuenta_ids),
        omitidas_administrativas=seleccion.omitidas,
        enviar_correo=enviar_correo,
        dry_run=True,
    )
    datos = asdict(resultado) | {'estado': 'LISTO'}
    logger.info('restablecimiento en bloque (preview): %s', datos)
    return datos


@shared_task(name='identidad.restablecer_acceso_en_bloque', acks_late=True)
def restablecer_acceso_en_bloque_tarea(
    clasificacion: str,
    alcance: str,
    enviar_correo: bool,
    motivo: str,
    actor: dict,
    confirmacion: int,
    cuenta_ids: list[int],
) -> dict:
    """Ejecuta el lote con la lista de ids de la vista previa."""
    if not cache.add(CANDADO, timezone.now().isoformat(), timeout=CANDADO_SEGUNDOS):
        return {'estado': 'EN_CURSO'}

    trace_id = uuid.uuid4().hex
    try:
        lector = obtener_lector_configuracion()
        dias = DIAS_POR_DEFECTO
        if lector is not None:
            try:
                dias = max(1, int(lector.obtener_entero(CLAVE_PASSWORD_INICIAL_DIAS)))
            except (TypeError, ValueError):
                dias = DIAS_POR_DEFECTO
        resultado = restablecer_acceso_en_bloque(
            RepoCuentasORM(),
            RepoPasswordInicialORM(),
            RepoPermisosVersionORM(),
            RepoPermisosORM(),
            RepoCondicionTrabajadorORM(),
            RepoCuentasClaveInicialORM(),
            publicar_evento_identidad,
            ActorSesionDTO(**actor),
            clasificacion=clasificacion,
            alcance=alcance,
            enviar_correo=enviar_correo,
            motivo=motivo,
            ahora=timezone.now(),
            dias_vigencia=dias,
            confirmacion=int(confirmacion),
            cuenta_ids=list(cuenta_ids),
            limpiar_bloqueo=limpiar_bloqueo,
        )
    except ConflictError as exc:
        logger.warning('restablecimiento en bloque: %s', exc)
        return {'estado': 'CONFLICTO', 'mensaje': str(exc)}
    finally:
        cache.delete(CANDADO)

    datos = asdict(resultado) | {
        'estado': 'LISTO',
        'clasificacion': clasificacion,
        'alcance': alcance,
        'motivo': motivo,
        'dias_vigencia': dias,
    }
    try:
        registrar_auditoria(
            trace_id=trace_id,
            actor_id=actor.get('cuenta_id'),
            actor_cedula=actor.get('cedula') or '',
            accion=ACCION_AUDITORIA,
            modulo='identidad',
            recurso_tipo='Usuario',
            recurso_id='',
            estado_nuevo=datos,
        )
    except Exception:  # noqa: BLE001 - la auditoría no debe tumbar el lote
        logger.exception('restablecimiento en bloque: no se pudo auditar')
    logger.info('restablecimiento en bloque: %s', datos)
    return datos
