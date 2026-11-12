"""Aplicación y reversión de una carga masiva (O28-F4, FIX-CARGA1).

Ningún cambio de condición se escribe con un `update` directo: se registra por
los flujos existentes de Movimientos/Cargos y Pasivos, que emiten
`cargo_movimiento_ejecutado` (historial, avisos, ciclo de vida de cuentas y
carnetización por egreso).
"""


from django.db import transaction
from django.db.models import ProtectedError
from django.utils import timezone

from apps.carga_masiva.domain.condicion import puede_aplicarse, puede_confirmarse
from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel, CargaMasivaModel
from core.domain.exceptions import ConflictError, ValidationError
from core.domain.notificaciones import SolicitudNotificacion
from core.infrastructure.providers import obtener_notificador
from core.presentation.audit import registrar_auditoria

from apps.carga_masiva.domain.constantes import (
    PERMISO_APROBAR,
    TIPO_NOTIFICACION_PENDIENTE,
)



from .aplicacion_comun import (  # noqa: F401 - re-exportadas
    _cedula_de,
    _es_origen_movimiento,
    _fecha,
    _id,
    _requiere_aprobacion,
    logger,
)
from .aplicacion_laborales import (  # noqa: F401 - re-exportadas
    _aplicar_cambio_condicion,
    _aplicar_cargo,
)
from .aplicacion_otras import _aplicar_otras  # noqa: F401 - re-exportada
from .aplicacion_personales import (  # noqa: F401 - re-exportadas
    _aplicar_datos_personales,
    _aplicar_familiar,
    _aplicar_salud_tallas,
)
from .aplicacion_reversion import (  # noqa: F401 - re-exportadas
    _revertir_carga_bloqueada,
    _revertir_movimiento,
)


def aplicar_carga(
    carga: CargaMasivaModel, actor_cedula: str, actor_id: int | None = None,
) -> CargaMasivaModel:
    if carga.estado == CargaMasivaModel.Estado.PENDIENTE_APROBACION:
        if carga.solicitada_por_cedula == actor_cedula:
            raise ConflictError('Otra persona debe aprobar esta carga.')
    elif carga.estado != CargaMasivaModel.Estado.ANALIZADA:
        raise ConflictError('La carga no está lista para aplicarse.')
    if _requiere_aprobacion() and carga.aprobada_por_cedula == '':
        carga.estado = CargaMasivaModel.Estado.PENDIENTE_APROBACION
        carga.save(update_fields=['estado'])
        _notificar_aprobacion(carga)
        raise ConflictError('La carga requiere la aprobación de otra persona.')
    aplicadas = 0
    fallidas = 0
    with transaction.atomic():
        # L2-05: se revalida el estado con la carga bloqueada; una segunda
        # aplicación concurrente espera aquí y encuentra la carga ya aplicada.
        bloqueada = CargaMasivaModel.objects.select_for_update().get(pk=carga.pk)
        if bloqueada.estado not in (
            CargaMasivaModel.Estado.ANALIZADA,
            CargaMasivaModel.Estado.PENDIENTE_APROBACION,
        ):
            raise ConflictError('La carga no está lista para aplicarse.')
        carga.estado = bloqueada.estado
        filas = list(carga.filas.select_for_update())
        # Los movimientos de condición se resuelven primero para que las demás
        # filas de la misma cédula encuentren el movimiento ya ejecutado.
        # Las altas de datos personales van primero: el cargo y las demás
        # secciones de una cédula nueva necesitan que el empleado exista.
        filas.sort(key=lambda f: (
            0 if f.tipo == 'datos_personales' else (
                1 if _es_origen_movimiento(f) else 2
            ),
            f.numero_fila,
        ))
        movimientos_hechos: set[str] = set()
        for fila in filas:
            if fila.aplicada or not puede_aplicarse(fila.estado, fila.confirmada):
                continue
            cedula = _cedula_de(fila)
            try:
                # Savepoint por fila: un error de BD no invalida el lote completo.
                with transaction.atomic():
                    if fila.estado == CargaMasivaFilaModel.Estado.REQUIERE_CONFIRMACION:
                        _aplicar_cambio_condicion(fila, movimientos_hechos, actor_id)
                    if fila.tipo == 'datos_personales':
                        anteriores = _aplicar_datos_personales(fila)
                    elif fila.tipo == 'familiares':
                        anteriores = _aplicar_familiar(fila)
                    elif fila.tipo == 'cargo_asignacion':
                        anteriores = _aplicar_cargo(fila, actor_id)
                        if fila.movimiento.get('tipo') == 'PASIVO_A_ACTIVO':
                            fila.movimiento['cargo_activo_id'] = anteriores.get('cargo_id')
                    elif fila.tipo == 'salud_tallas':
                        anteriores = _aplicar_salud_tallas(fila)
                    else:
                        anteriores = _aplicar_otras(fila, actor_id)
                    fila.anteriores = {**fila.anteriores, **anteriores}
                    fila.aplicada = True
                    fila.error_aplicacion = ''
                _auditar_fila(carga, fila, actor_id, actor_cedula)
                aplicadas += 1
            except Exception as exc:  # noqa: BLE001
                movimientos_hechos.discard(cedula)
                fila.error_aplicacion = str(exc)[:300]
                fallidas += 1
            fila.save(update_fields=['aplicada', 'anteriores', 'error_aplicacion', 'movimiento'])
        carga.filas_confirmadas = carga.filas.filter(confirmada=True).count()
        carga.estado = CargaMasivaModel.Estado.APLICADA
        carga.aplicada_en = timezone.now()
        carga.save(update_fields=['estado', 'aplicada_en', 'filas_confirmadas'])
    # L2-11: no existe un estado intermedio sin cambiar la interfaz; la carga
    # queda APLICADA y el conteo de filas fallidas se registra en el log. El
    # detalle por fila sigue en `error_aplicacion`.
    carga.filas_fallidas_aplicacion = fallidas
    if fallidas:
        logger.warning(
            'Carga masiva %s aplicada con %s fila(s) fallida(s) de %s.',
            carga.pk, fallidas, aplicadas + fallidas,
        )
    return carga

def confirmar_filas(
    carga: CargaMasivaModel,
    fila_ids: list[str],
    actor_cedula: str,
    actor_id: int | None = None,
) -> CargaMasivaModel:
    """Confirma el movimiento de una o varias filas de cambio de condición.

    Sin esta confirmación explícita la fila no se aplica. La confirmación es
    idempotente y puede hacerse mientras la carga espera aprobación.
    """
    if carga.estado not in (
        CargaMasivaModel.Estado.ANALIZADA,
        CargaMasivaModel.Estado.PENDIENTE_APROBACION,
    ):
        raise ConflictError('Solo se confirman filas de una carga analizada o pendiente de aprobación.')
    if not fila_ids:
        raise ValidationError('Seleccione al menos una fila para confirmar.', campo='filas')
    with transaction.atomic():
        filas = list(carga.filas.select_for_update().filter(pk__in=fila_ids))
        if len(filas) != len(set(fila_ids)):
            raise ValidationError('Alguna de las filas indicadas no existe en esta carga.', campo='filas')
        for fila in filas:
            completo, mensaje = puede_confirmarse(fila.estado, fila.movimiento)
            if not completo:
                raise ValidationError(
                    f'Fila {fila.numero_fila}: {mensaje}', campo='filas',
                )
        ahora = timezone.now()
        for fila in filas:
            fila.confirmada = True
            fila.confirmada_por_cedula = actor_cedula or ''
            fila.confirmada_en = ahora
            fila.save(update_fields=['confirmada', 'confirmada_por_cedula', 'confirmada_en'])
        carga.filas_confirmadas = carga.filas.filter(confirmada=True).count()
        carga.save(update_fields=['filas_confirmadas'])
    return carga

def _auditar_fila(
    carga: CargaMasivaModel, fila: CargaMasivaFilaModel,
    actor_id: int | None, actor_cedula: str,
) -> None:
    recurso = (
        fila.datos.get('cedula')
        or fila.datos.get('cedula_titular')
        or str(fila.pk)
    )
    estado_nuevo = {'carga_id': str(carga.id), 'fila': fila.numero_fila}
    if fila.movimiento:
        estado_nuevo['movimiento'] = fila.movimiento.get('tipo')
        estado_nuevo['condicion'] = (
            f"{fila.movimiento.get('condicion_actual')} -> "
            f"{fila.movimiento.get('condicion_nueva')}"
        )
    registrar_auditoria(
        trace_id=str(carga.id), actor_id=actor_id, actor_cedula=actor_cedula,
        actor_rol='', accion='CARGA_MASIVA_REGISTRO_APLICADO', modulo=carga.modulo,
        recurso_tipo=fila.tipo, recurso_id=str(recurso),
        estado_nuevo=estado_nuevo,
    )

def _notificar_aprobacion(carga: CargaMasivaModel) -> None:
    notificador = obtener_notificador()
    if notificador is None:
        return
    notificador.notificar(SolicitudNotificacion(
        tipo=TIPO_NOTIFICACION_PENDIENTE,
        titulo='Carga masiva pendiente de aprobación',
        mensaje=(
            f'La carga «{carga.archivo_nombre}» ({carga.poblacion.lower()}) tiene '
            f'{carga.filas_validas} registro(s) listos. Revísela y apruébela o '
            'rechácela con un motivo.'
        ),
        permiso_destino=PERMISO_APROBAR,
        excluir_cedulas=(carga.solicitada_por_cedula,),
        ref_tipo='carga_masiva',
        ref_id=str(carga.id),
        clave='pendiente-aprobacion',
        modulo=carga.modulo,
    ))

def aprobar_carga(
    carga: CargaMasivaModel, actor_cedula: str, actor_id: int | None = None,
) -> CargaMasivaModel:
    if carga.estado != CargaMasivaModel.Estado.PENDIENTE_APROBACION:
        raise ConflictError('La carga no está pendiente de aprobación.')
    if carga.solicitada_por_cedula == actor_cedula:
        raise ConflictError('Quien cargó el archivo no puede aprobarlo.')
    carga.aprobada_por_cedula = actor_cedula
    carga.save(update_fields=['aprobada_por_cedula'])
    return aplicar_carga(carga, actor_cedula, actor_id)

def rechazar_carga(carga: CargaMasivaModel, actor_cedula: str, motivo: str) -> CargaMasivaModel:
    if carga.estado != CargaMasivaModel.Estado.PENDIENTE_APROBACION:
        raise ConflictError('La carga no está pendiente de aprobación.')
    if carga.solicitada_por_cedula == actor_cedula:
        raise ConflictError('Quien cargó el archivo no puede rechazarlo.')
    if not motivo or not motivo.strip():
        raise ValidationError('Indique el motivo del rechazo.', campo='motivo')
    carga.estado = CargaMasivaModel.Estado.RECHAZADA
    carga.motivo_rechazo = motivo.strip()
    carga.save(update_fields=['estado', 'motivo_rechazo'])
    return carga

def revertir_carga(carga: CargaMasivaModel, actor_id: int | None = None) -> CargaMasivaModel:
    if carga.estado != CargaMasivaModel.Estado.APLICADA:
        raise ConflictError('Solo se puede revertir una carga aplicada.')
    try:
        return _revertir_carga_bloqueada(carga, actor_id)
    except ProtectedError as exc:
        # L2-10: registros posteriores (cuenta, cargo, carnet...) impiden el borrado.
        raise ConflictError(
            'No se puede revertir la carga: algunos registros creados por ella ya '
            'tienen datos asociados (cuenta, cargo, carnet u otros).'
        ) from exc
