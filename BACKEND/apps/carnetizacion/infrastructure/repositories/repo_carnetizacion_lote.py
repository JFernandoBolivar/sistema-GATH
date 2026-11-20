"""Impresión por lote de carnets de trabajadores (B-6): cola de impresión y PDF A4 del lote."""
from typing import Any

from django.db import transaction

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.carnetizacion.domain.services.plantilla_defecto import (
    plantilla_defecto_pasivo,
    plantilla_defecto_trabajador,
)
from apps.carnetizacion.domain.value_objects import estado_fisico_carnet as est
from apps.carnetizacion.domain.value_objects.modo_duplex import SIN_ESPEJO
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetCicloModel,
    CarnetEmitidoModel,
)
from apps.carnetizacion.infrastructure.pdf.carnet_pdf_lote import generar_pdf_lote
from core.domain.exceptions import ValidationError

from . import repo_carnetizacion_comun as comun

MAXIMO_POR_LOTE = 90  # 10 hojas A4 de 9 carnets por cara
LIMITE_COLA = 500


class RepoLoteCarnetsMixin:
    def cola_impresion_carnets(self) -> list[dict[str, Any]]:
        """Carnets vigentes aún sin imprimir (estado EMITIDO), los más antiguos primero."""
        impresos = CarnetCicloModel.objects.exclude(estado=est.EMITIDO).values('carnet_id')
        filas = list(
            CarnetEmitidoModel.objects.select_related('employee', 'motivo')
            .filter(activo=True)
            .exclude(pk__in=impresos)
            .order_by('fecha_emision')[:LIMITE_COLA]
        )
        cedulas = [f.employee.cedulaidentidad for f in filas if f.employee_id]
        asignaciones: dict[str, Any] = {}
        for asig in (
            AsigTrabajoModel.objects.select_related('denominacioncargoid', 'DireccionGeneral')
            .filter(employee_id__in=cedulas)
            .order_by('-fecha_actualizacion')
        ):
            asignaciones.setdefault(asig.employee_id, asig)
        resultado = []
        for fila in filas:
            emp = fila.employee
            cargo, departamento = comun.cargo_y_departamento(asignaciones.get(emp.cedulaidentidad))
            resultado.append({
                'carnet_id': fila.pk,
                'cedula': emp.cedulaidentidad,
                'nombre': f'{emp.nombres} {emp.apellidos}'.strip(),
                'cargo': cargo,
                'departamento': departamento,
                'motivo': getattr(fila.motivo, 'nombre', '') or '',
                'fecha_emision': fila.fecha_emision.isoformat() if fila.fecha_emision else None,
            })
        return resultado

    def generar_pdf_lote_carnets(
        self, carnet_ids: list[int], marcar_impresos: bool = False, por: str = '',
        modo_duplex: str = SIN_ESPEJO,
    ) -> bytes:
        """Hojas A4 (9 por cara, marcas de corte y reverso espejado según el modo elegido) con
        los carnets indicados, cada uno con el diseño congelado al emitirlo. Con
        `marcar_impresos` los que estaban EMITIDO pasan a IMPRESO (y se avisa al titular), en
        la misma transacción."""
        ids = list(dict.fromkeys(int(i) for i in carnet_ids))
        if not ids:
            raise ValidationError('Seleccione al menos un carnet.', campo='carnet_ids')
        if len(ids) > MAXIMO_POR_LOTE:
            raise ValidationError(f'Un lote admite hasta {MAXIMO_POR_LOTE} carnets.', campo='carnet_ids')
        filas = {
            f.pk: f for f in CarnetEmitidoModel.objects.select_related('employee', 'motivo').filter(pk__in=ids)
        }
        faltan = [i for i in ids if i not in filas]
        if faltan:
            raise ValidationError(f'Carnets inexistentes: {faltan}.', campo='carnet_ids')
        anulados = [i for i in ids if not filas[i].activo]
        if anulados:
            raise ValidationError(f'No se imprimen carnets anulados: {anulados}.', campo='carnet_ids')

        tarjetas = []
        for i in ids:
            datos, definicion = self._datos_y_definicion_de_carnet(filas[i])
            if not definicion:
                definicion = (
                    plantilla_defecto_pasivo() if comun._es_pasivo(filas[i].employee)
                    else plantilla_defecto_trabajador()
                )
            tarjetas.append({'definicion': definicion, 'datos': datos})

        with transaction.atomic():
            try:
                pdf = generar_pdf_lote(tarjetas, modo_duplex)
            except ValueError as exc:  # tamaños mezclados o formato que no cabe en A4
                raise ValidationError(str(exc), campo='carnet_ids') from exc
            if marcar_impresos:
                estados = self.estados_fisicos(ids)
                for i in ids:
                    if estados.get(i) == est.EMITIDO:
                        self.marcar_carnet_impreso(i, por)
        return pdf
