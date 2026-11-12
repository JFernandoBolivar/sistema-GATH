"""
U2: vista previa (síncrona), Excel y ejecución del restablecimiento de acceso en bloque.

La vista previa solo consulta tablas (sin `check_password`) y responde al instante. Guarda
en caché, por actor/clasificación/alcance y 30 minutos, **la lista de `cuenta_id` elegidas**;
la ejecución y el Excel la reutilizan. Con `VENCIDA`/`SIN_PRIMER_INGRESO` la ejecución no
rehashea y es síncrona; solo `TODOS` va por Celery.
"""
import logging
import uuid
from dataclasses import asdict

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.restablecer_acceso_en_bloque import (
    armar_filas,
    restablecer_acceso_en_bloque,
    seleccionar_cuentas,
)
from apps.identidad.domain.services.politica_password_inicial import vencimiento_desde
from apps.identidad.domain.value_objects.restablecimiento_bloque import Alcance, Clasificacion
from apps.identidad.infrastructure.providers.bloqueos_login import limpiar_bloqueo
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_clave_inicial_orm import (
    RepoCuentasClaveInicialORM,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_detalle_cuentas_bloque_orm import (
    RepoDetalleCuentasBloqueORM,
)
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.identidad.infrastructure.repositories.repo_permisos_orm import RepoPermisosORM
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.identidad.infrastructure.signals import publicar_evento_identidad
from apps.configuracion.domain.parametros import definicion_de
from core.domain.configuracion import CLAVE_PASSWORD_INICIAL_DIAS
from core.domain.exceptions import ConflictError
from core.infrastructure.auditoria_contexto import con_origen_de_tarea
from core.infrastructure.providers import obtener_lector_configuracion
from core.presentation.audit import registrar_auditoria

logger = logging.getLogger('security_backend')

CANDADO = 'identidad:lock:restablecer_acceso_bloque'
CANDADO_SEGUNDOS = 2 * 60 * 60
PREVIEW_TTL = 30 * 60
ACCION_AUDITORIA = 'identidad.acceso_restablecido_bloque'
DIAS_POR_DEFECTO = int(definicion_de(CLAVE_PASSWORD_INICIAL_DIAS).defecto)
MUESTRA_MAXIMA = 50


def clave_preview(actor_id, clasificacion: str, alcance: str) -> str:
    """Clave de caché compartida por la vista previa, el Excel y la ejecución."""
    return f'identidad:preview_restablecimiento_bloque:{actor_id}:{clasificacion}:{alcance}'


def dias_vigencia() -> int:
    """Plazo de la contraseña inicial (`plazos.password_inicial_dias`)."""
    lector = obtener_lector_configuracion()
    if lector is None:
        return DIAS_POR_DEFECTO
    try:
        return max(1, int(lector.obtener_entero(CLAVE_PASSWORD_INICIAL_DIAS)))
    except (TypeError, ValueError):
        return DIAS_POR_DEFECTO


def vence_en_nuevo(ahora=None, dias: int | None = None) -> str:
    """Fecha (ISO, zona local) hasta la que quedará vigente la contraseña renovada."""
    ahora = ahora or timezone.now()
    vence = vencimiento_desde(ahora, dias or dias_vigencia())
    return timezone.localtime(vence).date().isoformat()


def seleccionar(clasificacion: str, alcance: str, actor: dict, ahora=None):
    """Selección síncrona de cuentas (solo consultas; sin comprobar hashes)."""
    return seleccionar_cuentas(
        RepoCondicionTrabajadorORM(),
        RepoPermisosORM(),
        RepoCuentasClaveInicialORM(),
        ActorSesionDTO(**actor),
        Clasificacion(clasificacion),
        Alcance(alcance),
        ahora or timezone.now(),
    )


def _fila_dict(fila) -> dict:
    return {
        'cuenta_id': fila.cuenta_id,
        'cedula': fila.cedula,
        'nombre': fila.nombre,
        'condicion': fila.condicion,
        'vence_en': timezone.localtime(fila.vence_en).isoformat() if fila.vence_en else None,
    }


def calcular_vista_previa(clasificacion: str, alcance: str, actor: dict) -> dict:
    """Vista previa instantánea: contadores, muestra de 50 filas y lista de ids en caché."""
    ahora = timezone.now()
    seleccion = seleccionar(clasificacion, alcance, actor, ahora)
    ids = list(seleccion.cuenta_ids)
    cache.set(clave_preview(actor.get('cuenta_id'), clasificacion, alcance), ids, PREVIEW_TTL)
    filas = armar_filas(RepoDetalleCuentasBloqueORM(), RepoCondicionTrabajadorORM(), ids)
    return {
        'total': len(ids),
        'activos': seleccion.activos,
        'pasivos': seleccion.pasivos,
        'omitidas_administrativas': seleccion.omitidas,
        'revisadas': seleccion.revisadas,
        'muestra': [_fila_dict(fila) for fila in filas[:MUESTRA_MAXIMA]],
        'vence_en_nuevo': vence_en_nuevo(ahora),
    }


def filas_del_excel(clasificacion: str, alcance: str, actor: dict) -> list:
    """Todas las cuentas de la selección: la lista en caché del actor o, si falta, se recalcula."""
    ids = cache.get(clave_preview(actor.get('cuenta_id'), clasificacion, alcance))
    if ids is None:
        ids = list(seleccionar(clasificacion, alcance, actor).cuenta_ids)
    return armar_filas(RepoDetalleCuentasBloqueORM(), RepoCondicionTrabajadorORM(), ids)


def ejecutar_bloque(
    clasificacion: str,
    alcance: str,
    enviar_correo: bool,
    motivo: str,
    actor: dict,
    confirmacion: int,
    cuenta_ids: list[int],
) -> dict:
    """Ejecuta el lote bajo candado y audita. Lo usan la vista (síncrona) y la tarea (TODOS)."""
    if not cache.add(CANDADO, timezone.now().isoformat(), timeout=CANDADO_SEGUNDOS):
        return {'estado': 'EN_CURSO'}

    trace_id = uuid.uuid4().hex
    try:
        dias = dias_vigencia()
        ahora = timezone.now()
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
            ahora=ahora,
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
        'vence_en_nuevo': vence_en_nuevo(ahora, dias),
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


@shared_task(name='identidad.restablecer_acceso_en_bloque', acks_late=True)
@con_origen_de_tarea
def restablecer_acceso_en_bloque_tarea(
    clasificacion: str,
    alcance: str,
    enviar_correo: bool,
    motivo: str,
    actor: dict,
    confirmacion: int,
    cuenta_ids: list[int],
) -> dict:
    """Ejecución asíncrona (alcance TODOS, que rehashea cada clave)."""
    return ejecutar_bloque(
        clasificacion, alcance, enviar_correo, motivo, actor, confirmacion, cuenta_ids,
    )
