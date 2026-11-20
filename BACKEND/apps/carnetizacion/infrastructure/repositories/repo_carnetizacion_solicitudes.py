"""Solicitudes de carnet: el trabajador solicita desde Autogestión y RRHH aprueba o rechaza."""
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.carnetizacion.domain.value_objects import estado_solicitud_carnet as est
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    MotivosEmisionModel,
    SolicitudCarnetModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

from . import repo_carnetizacion_comun as comun

LIMITE_LISTADO = 300


def _texto(valor: Any, campo: str, obligatorio: bool = False) -> str:
    texto = str(valor or '').strip()
    if obligatorio and not texto:
        raise ValidationError('Este dato es obligatorio.', campo=campo)
    if len(texto) > est.LARGO_MAXIMO_TEXTO:
        raise ValidationError(
            f'El texto no puede superar {est.LARGO_MAXIMO_TEXTO} caracteres.', campo=campo,
        )
    return texto


def _resumen(sol: SolicitudCarnetModel, motivos: dict[int, str] | None = None) -> dict[str, Any]:
    if motivos is None:
        motivos = dict(MotivosEmisionModel.objects.filter(pk=sol.motivo_id).values_list('pk', 'nombre'))
    return {
        'id': str(sol.id),
        'cedula': sol.cedula,
        'estado': sol.estado,
        'motivo_id': sol.motivo_id,
        'motivo': motivos.get(sol.motivo_id, ''),
        'justificacion': sol.justificacion,
        'motivo_rechazo': sol.motivo_rechazo,
        'carnet_id': sol.carnet_id,
        'fecha_solicitud': sol.created_at.isoformat() if sol.created_at else None,
        'fecha_resolucion': sol.fecha_resolucion.isoformat() if sol.fecha_resolucion else None,
    }


class RepoSolicitudesCarnetMixin:
    # --- Lado del trabajador (Autogestión) ---------------------------------------------------

    def crear_solicitud_carnet(self, cedula: str, motivo_id: int, justificacion: str = '') -> dict[str, Any]:
        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if empleado is None:
            raise NotFoundError(f'Empleado con cédula {cedula} no encontrado')
        if not MotivosEmisionModel.objects.filter(pk=motivo_id).exists():
            raise ValidationError('El motivo de emisión seleccionado no existe.', campo='motivo_id')
        comun.exigir_condicion_para_carnet(empleado)
        texto = _texto(justificacion, 'observaciones')
        if SolicitudCarnetModel.objects.filter(cedula=cedula, estado=est.PENDIENTE).exists():
            raise ConflictError('Ya tiene una solicitud de carnet en revisión por Recursos Humanos.')
        try:
            with transaction.atomic():
                sol = SolicitudCarnetModel.objects.create(
                    cedula=cedula, motivo_id=motivo_id, justificacion=texto,
                )
        except IntegrityError:
            # Dos envíos simultáneos: la restricción de BD deja pasar solo uno.
            raise ConflictError(
                'Ya tiene una solicitud de carnet en revisión por Recursos Humanos.'
            ) from None
        return _resumen(sol)

    def ultima_solicitud_carnet(self, cedula: str) -> dict[str, Any] | None:
        sol = SolicitudCarnetModel.objects.filter(cedula=cedula).order_by('-created_at').first()
        return _resumen(sol) if sol else None

    def cancelar_solicitud_carnet(self, cedula: str, solicitud_id: str) -> dict[str, Any]:
        with transaction.atomic():
            sol = (
                SolicitudCarnetModel.objects.select_for_update()
                .filter(pk=solicitud_id, cedula=cedula)  # Zero-IDOR: solo la propia
                .first()
            )
            if sol is None:
                raise NotFoundError('Solicitud de carnet no encontrada.')
            if sol.estado != est.PENDIENTE:
                raise ConflictError('La solicitud ya fue atendida y no se puede retirar.')
            sol.estado = est.CANCELADA
            sol.resuelta_por_cedula = cedula
            sol.fecha_resolucion = timezone.now()
            sol.save(update_fields=['estado', 'resuelta_por_cedula', 'fecha_resolucion', 'updated_at'])
        return _resumen(sol)

    # --- Lado de Recursos Humanos (bandeja de Carnetización) ---------------------------------

    def listar_solicitudes_carnet(self, estado: str | None = None) -> list[dict[str, Any]]:
        qs = SolicitudCarnetModel.objects.all()
        if estado:
            if estado not in est.ESTADOS:
                raise ValidationError('Estado de solicitud no válido.', campo='estado')
            qs = qs.filter(estado=estado)
        # Las pendientes primero (son el trabajo), después las más recientes.
        pendientes = list(qs.filter(estado=est.PENDIENTE).order_by('created_at')[:LIMITE_LISTADO])
        resto = list(
            qs.exclude(estado=est.PENDIENTE).order_by('-created_at')[: max(0, LIMITE_LISTADO - len(pendientes))]
        )
        solicitudes = pendientes + resto
        cedulas = {s.cedula for s in solicitudes}

        empleados = {e.cedulaidentidad: e for e in EmployeeModel.objects.filter(cedulaidentidad__in=cedulas)}
        asignaciones: dict[str, Any] = {}
        for asig in (
            AsigTrabajoModel.objects.select_related('denominacioncargoid', 'DireccionGeneral')
            .filter(employee_id__in=cedulas)
            .order_by('-fecha_actualizacion')
        ):
            asignaciones.setdefault(asig.employee_id, asig)
        # CarnetEmitido enlaza al empleado por su id interno, no por la cédula.
        carnets: dict[str, Any] = {}
        for carnet in (
            CarnetEmitidoModel.objects.select_related('employee')
            .filter(employee__cedulaidentidad__in=cedulas)
            .order_by('-fecha_emision')
        ):
            carnets.setdefault(carnet.employee.cedulaidentidad, carnet)
        motivos = dict(MotivosEmisionModel.objects.values_list('pk', 'nombre'))
        ahora = timezone.now()

        filas = []
        for sol in solicitudes:
            emp = empleados.get(sol.cedula)
            cargo, departamento = comun.cargo_y_departamento(asignaciones.get(sol.cedula))
            ultimo = carnets.get(sol.cedula)
            if ultimo is None:
                anterior = 'NINGUNO'
            else:
                vence = comun.vencimiento_de_carnet(ultimo)
                anterior = 'ACTIVO' if ultimo.activo and (vence is None or vence > ahora) else 'VENCIDO'
            fila = _resumen(sol, motivos)
            fila.update({
                'nombres': getattr(emp, 'nombres', '') or '',
                'apellidos': getattr(emp, 'apellidos', '') or '',
                'cargo': cargo or '',
                'departamento': departamento or '',
                'condicion': comun.condicion_titular(emp or sol.cedula),
                'carnet_anterior_estado': anterior,
            })
            filas.append(fila)
        return filas

    def aprobar_solicitud_carnet(
        self, solicitud_id: str, cedula: str, carnet_id: int, resuelta_por: str,
    ) -> dict[str, Any]:
        """Marca la solicitud como aprobada con el carnet ya emitido. Se llama dentro de la
        MISMA transacción de la emisión: si algo falla no queda un carnet sin su solicitud."""
        sol = SolicitudCarnetModel.objects.select_for_update().filter(pk=solicitud_id).first()
        if sol is None:
            raise NotFoundError('Solicitud de carnet no encontrada.')
        if sol.cedula != str(cedula):
            raise ValidationError('La solicitud no corresponde a este titular.', campo='solicitud_id')
        if sol.estado != est.PENDIENTE:
            raise ConflictError('La solicitud ya fue atendida.')
        sol.estado = est.APROBADA
        sol.carnet_id = carnet_id
        sol.resuelta_por_cedula = resuelta_por or ''
        sol.fecha_resolucion = timezone.now()
        sol.save(update_fields=[
            'estado', 'carnet_id', 'resuelta_por_cedula', 'fecha_resolucion', 'updated_at',
        ])
        return _resumen(sol)

    def exigir_solicitud_pendiente(self, solicitud_id: str, cedula: str) -> None:
        """Valida antes de emitir: que la solicitud exista, sea de este titular y siga pendiente."""
        sol = SolicitudCarnetModel.objects.filter(pk=solicitud_id).first()
        if sol is None:
            raise NotFoundError('Solicitud de carnet no encontrada.')
        if sol.cedula != str(cedula):
            raise ValidationError('La solicitud no corresponde a este titular.', campo='solicitud_id')
        if sol.estado != est.PENDIENTE:
            raise ConflictError('La solicitud ya fue atendida.')

    def rechazar_solicitud_carnet(self, solicitud_id: str, motivo: str, resuelta_por: str) -> dict[str, Any]:
        texto = _texto(motivo, 'motivo', obligatorio=True)
        with transaction.atomic():
            sol = SolicitudCarnetModel.objects.select_for_update().filter(pk=solicitud_id).first()
            if sol is None:
                raise NotFoundError('Solicitud de carnet no encontrada.')
            if sol.estado != est.PENDIENTE:
                raise ConflictError('La solicitud ya fue atendida.')
            sol.estado = est.RECHAZADA
            sol.motivo_rechazo = texto
            sol.resuelta_por_cedula = resuelta_por or ''
            sol.fecha_resolucion = timezone.now()
            sol.save(update_fields=[
                'estado', 'motivo_rechazo', 'resuelta_por_cedula', 'fecha_resolucion', 'updated_at',
            ])
        return _resumen(sol)
