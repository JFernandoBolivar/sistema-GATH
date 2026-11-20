"""Ciclo físico del carnet emitido (B-5): impreso, entregado y anulado con motivo."""
import logging
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.carnetizacion.domain.value_objects import estado_fisico_carnet as est
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetCicloModel,
    CarnetEmitidoModel,
)
from core.domain.exceptions import DomainError, NotFoundError, ValidationError
from core.domain.notificaciones import SolicitudNotificacion
from core.infrastructure.providers import obtener_notificador

logger = logging.getLogger('gath.carnetizacion')

LARGO_MAXIMO = 500


def _texto(valor: Any, campo: str, obligatorio: bool = True, largo: int = LARGO_MAXIMO) -> str:
    texto = str(valor or '').strip()
    if obligatorio and not texto:
        raise ValidationError('Este dato es obligatorio.', campo=campo)
    if len(texto) > largo:
        raise ValidationError(f'El texto no puede superar {largo} caracteres.', campo=campo)
    return texto


def _resumen(carnet: Any, ciclo: Any | None) -> dict[str, Any]:
    def iso(valor):
        return valor.isoformat() if valor else None

    return {
        'carnet_id': carnet.pk,
        'cedula': carnet.employee.cedulaidentidad if carnet.employee_id else '',
        'estado': est.estado_efectivo(carnet.activo, getattr(ciclo, 'estado', None)),
        'fecha_emision': iso(carnet.fecha_emision),
        'fecha_impresion': iso(getattr(ciclo, 'fecha_impresion', None)),
        'fecha_entrega': iso(getattr(ciclo, 'fecha_entrega', None)),
        'recibido_por': getattr(ciclo, 'recibido_por', '') or '',
        'fecha_anulacion': iso(getattr(ciclo, 'fecha_anulacion', None)),
        'motivo_anulacion': getattr(ciclo, 'motivo_anulacion', '') or '',
    }


def _avisar_listo_para_retirar(cedula: str, carnet_id: int) -> None:
    def enviar():
        notificador = obtener_notificador()
        if notificador is None or not cedula:
            return
        try:
            notificador.notificar(SolicitudNotificacion(
                tipo='CARNET_LISTO_PARA_RETIRAR',
                titulo='Su carnet está listo para retirar',
                mensaje='Su carnet institucional ya fue impreso. Puede retirarlo en Talento Humano.',
                cedula_destino=cedula,
                enlace='/autogestion/mi-carnet',
                ref_tipo='CarnetEmitido',
                ref_id=str(carnet_id),
                modulo='autogestion',
            ))
        except DomainError:
            logger.exception('No se pudo avisar que el carnet %s está listo.', carnet_id)

    transaction.on_commit(enviar)


class RepoCicloCarnetMixin:
    def _carnet_y_ciclo(self, carnet_id: int, bloquear: bool = False) -> tuple[Any, Any]:
        consulta = CarnetEmitidoModel.objects.select_related('employee')
        if bloquear:
            consulta = consulta.select_for_update(of=('self',))
        carnet = consulta.filter(pk=carnet_id).first()
        if carnet is None:
            raise NotFoundError(f'Carnet con id {carnet_id} no encontrado')
        ciclo = CarnetCicloModel.objects.filter(carnet_id=carnet_id).first()
        return carnet, ciclo

    def estado_fisico_carnet(self, carnet_id: int) -> dict[str, Any]:
        carnet, ciclo = self._carnet_y_ciclo(carnet_id)
        return _resumen(carnet, ciclo)

    def estados_fisicos(self, carnet_ids: list[int]) -> dict[int, str]:
        """Estado efectivo de varios carnets en dos consultas (para listados)."""
        ciclos = dict(
            CarnetCicloModel.objects.filter(carnet_id__in=carnet_ids).values_list('carnet_id', 'estado')
        )
        return {
            pk: est.estado_efectivo(activo, ciclos.get(pk))
            for pk, activo in CarnetEmitidoModel.objects.filter(pk__in=carnet_ids).values_list('pk', 'activo')
        }

    def marcar_carnet_impreso(self, carnet_id: int, por: str) -> dict[str, Any]:
        with transaction.atomic():
            carnet, ciclo = self._carnet_y_ciclo(carnet_id, bloquear=True)
            est.exigir_transicion(est.estado_efectivo(carnet.activo, getattr(ciclo, 'estado', None)), est.IMPRESO)
            ciclo, _ = CarnetCicloModel.objects.update_or_create(
                carnet_id=carnet_id,
                defaults={'estado': est.IMPRESO, 'fecha_impresion': timezone.now(), 'impreso_por_cedula': por or ''},
            )
            _avisar_listo_para_retirar(carnet.employee.cedulaidentidad if carnet.employee_id else '', carnet_id)
        return _resumen(carnet, ciclo)

    def marcar_carnet_entregado(self, carnet_id: int, recibido_por: str, por: str) -> dict[str, Any]:
        receptor = _texto(recibido_por, 'recibido_por', largo=150)
        with transaction.atomic():
            carnet, ciclo = self._carnet_y_ciclo(carnet_id, bloquear=True)
            est.exigir_transicion(est.estado_efectivo(carnet.activo, getattr(ciclo, 'estado', None)), est.ENTREGADO)
            ciclo.estado = est.ENTREGADO
            ciclo.fecha_entrega = timezone.now()
            ciclo.entregado_por_cedula = por or ''
            ciclo.recibido_por = receptor
            ciclo.save(update_fields=[
                'estado', 'fecha_entrega', 'entregado_por_cedula', 'recibido_por', 'updated_at',
            ])
        return _resumen(carnet, ciclo)

    def anular_carnet(self, carnet_id: int, motivo: str, por: str) -> dict[str, Any]:
        """Anula (revoca) el carnet con motivo: deja de ser válido en el QR y queda el registro."""
        texto = _texto(motivo, 'motivo')
        with transaction.atomic():
            carnet, ciclo = self._carnet_y_ciclo(carnet_id, bloquear=True)
            est.exigir_transicion(est.estado_efectivo(carnet.activo, getattr(ciclo, 'estado', None)), est.ANULADO)
            carnet.activo = False
            carnet.save(update_fields=['activo'])
            ciclo, _ = CarnetCicloModel.objects.update_or_create(
                carnet_id=carnet_id,
                defaults={
                    'estado': est.ANULADO,
                    'fecha_anulacion': timezone.now(),
                    'anulado_por_cedula': por or '',
                    'motivo_anulacion': texto,
                },
            )
        return _resumen(carnet, ciclo)
