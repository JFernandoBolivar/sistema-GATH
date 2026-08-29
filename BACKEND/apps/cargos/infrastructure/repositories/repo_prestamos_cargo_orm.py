"""
Mixin ORM del subsistema de préstamo de cargo / encargaduría (Fase 2.5 del
plan de reparación). Separado de `repo_cargos_orm.py` por el techo de 400
líneas por archivo (Regla B13); `RepoCargosORM` lo hereda para completar el
puerto `RepoCargos` como un único objeto.

Réplica funcional de `RAC/services/prestamo_cargo_services.py` y del modelo
`RAC/models/historial_personal_models.py::PrestamoCargo`.
"""
from django.db import transaction
from django.utils import timezone

from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from apps.cargos.domain import events
from apps.cargos.domain.entities.prestamo_cargo import PrestamoCargo
from apps.cargos.infrastructure.mappers.mapper_cargos import prestamo_a_entidad
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.cargos.infrastructure.models.prestamo_models import PrestamoCargoModel
from apps.catalogos.infrastructure.models.catalogo_models import EstatusModel, TipoMovimientoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class RepoPrestamosCargoORM:
    def _calcular_estatus_prestamo(self, fecha_fin, hoy) -> EstatusModel:
        if fecha_fin <= hoy:
            nombre = 'FINALIZADA'
        elif (fecha_fin - hoy).days <= 5:
            nombre = 'POR VENCER'
        else:
            nombre = 'ACTIVO'
        estatus, _ = EstatusModel.objects.get_or_create(estatus__iexact=nombre, defaults={'estatus': nombre})
        return estatus

    def _sincronizar_estatus_cargos(self, prestamo: PrestamoCargoModel) -> None:
        activo, _ = EstatusModel.objects.get_or_create(estatus__iexact='ACTIVO', defaults={'estatus': 'ACTIVO'})
        suspendido, _ = EstatusModel.objects.get_or_create(estatus__iexact='SUSPENDIDO', defaults={'estatus': 'SUSPENDIDO'})
        estatus_prestamo = prestamo.estatus.estatus.upper()

        if estatus_prestamo in ('ACTIVO', 'POR VENCER'):
            AsigTrabajoModel.objects.filter(
                employee_id=prestamo.empleado_encargado_id, estatusid__estatus__iexact='ACTIVO'
            ).update(estatusid=suspendido)
            cargo = prestamo.cargo_encargado
            if cargo:
                cargo.estatusid = suspendido
                cargo.save(update_fields=['estatusid', 'fecha_actualizacion'])
        elif estatus_prestamo == 'FINALIZADA':
            AsigTrabajoModel.objects.filter(
                employee_id=prestamo.empleado_encargado_id, estatusid__estatus__iexact='SUSPENDIDO'
            ).update(estatusid=activo)
            cargo = prestamo.cargo_encargado
            if cargo:
                cargo.estatusid = activo
                cargo.save(update_fields=['estatusid', 'fecha_actualizacion'])

    def _obtener_prestamo(self, prestamo_id: int) -> PrestamoCargo | None:
        fila = (
            PrestamoCargoModel.objects.select_related(
                'empleado_encargado', 'cargo_encargado', 'cargo_encargado__employee', 'motivo', 'estatus',
            )
            .filter(pk=prestamo_id)
            .first()
        )
        return prestamo_a_entidad(fila) if fila else None

    def listar_prestamos(self, solo_activos: bool = False) -> list[PrestamoCargo]:
        qs = PrestamoCargoModel.objects.select_related(
            'empleado_encargado', 'cargo_encargado', 'cargo_encargado__employee', 'motivo', 'estatus',
        ).all()
        if solo_activos:
            qs = qs.exclude(estatus__estatus__iexact='FINALIZADA')
        return [prestamo_a_entidad(p) for p in qs]

    @transaction.atomic
    def crear_prestamo(
        self,
        cedula_encargado: str,
        cargo_id: int,
        motivo_id: int,
        fecha_inicio,
        fecha_fin,
        usuario_id: int,
    ) -> PrestamoCargo:
        if fecha_fin < fecha_inicio:
            raise ValidationError('La fecha de fin no puede ser anterior a la fecha de inicio.')

        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula_encargado).first()
        if not empleado:
            raise NotFoundError(f"Empleado con cédula {cedula_encargado} no encontrado.")

        cargo = AsigTrabajoModel.objects.select_for_update().filter(pk=cargo_id).first()
        if not cargo:
            raise NotFoundError(f"Cargo con id {cargo_id} no encontrado")

        try:
            motivo = TipoMovimientoModel.objects.get(pk=motivo_id)
        except TipoMovimientoModel.DoesNotExist as exc:
            raise NotFoundError(f"Motivo de movimiento {motivo_id} no encontrado.") from exc

        hoy = timezone.localdate()

        if PrestamoCargoModel.objects.filter(
            cargo_encargado_id=cargo_id, fecha_fin__gte=hoy
        ).exclude(estatus__estatus__iexact='FINALIZADA').exists():
            raise ConflictError('Ya existe una encargaduría activa para este cargo.')
        if PrestamoCargoModel.objects.filter(
            empleado_encargado_id=cedula_encargado, fecha_fin__gte=hoy
        ).exclude(estatus__estatus__iexact='FINALIZADA').exists():
            raise ConflictError('El trabajador ya tiene una encargaduría activa.')

        estatus_calculado = self._calcular_estatus_prestamo(fecha_fin, hoy)

        prestamo = PrestamoCargoModel.objects.create(
            empleado_encargado=empleado,
            cargo_encargado=cargo,
            motivo=motivo,
            estatus=estatus_calculado,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            ejecutado_por_id=usuario_id,
        )
        self._sincronizar_estatus_cargos(prestamo)

        events.cargo_movimiento_ejecutado.send(
            sender=RepoPrestamosCargoORM,
            cargo_id=cargo.pk,
            cedula=cedula_encargado,
            tipo_movimiento='CAMBIO DE ESTATUS',
            motivo_id=motivo_id,
            usuario_id=usuario_id,
        )

        return self._obtener_prestamo(prestamo.pk)

    @transaction.atomic
    def finalizar_prestamo(self, prestamo_id: int) -> PrestamoCargo:
        prestamo = PrestamoCargoModel.objects.select_for_update().filter(pk=prestamo_id).first()
        if not prestamo:
            raise NotFoundError(f"Préstamo {prestamo_id} no encontrado.")

        finalizada, _ = EstatusModel.objects.get_or_create(estatus__iexact='FINALIZADA', defaults={'estatus': 'FINALIZADA'})
        if prestamo.estatus_id == finalizada.pk:
            raise ConflictError('Este préstamo ya se encuentra finalizado.')

        prestamo.estatus = finalizada
        prestamo.fecha_fin = timezone.localdate()
        prestamo.save(update_fields=['estatus', 'fecha_fin'])
        self._sincronizar_estatus_cargos(prestamo)

        return self._obtener_prestamo(prestamo.pk)
