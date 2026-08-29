"""
Repositorio ORM de Pasivos (Reglas B4, B7, D-09).
"""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from apps.cargos.domain import events
from apps.pasivos.domain.entities.pasivo import Pasivo
from apps.pasivos.infrastructure.mappers.mapper_pasivos import (
    pasivo_a_entidad,
    pasivo_desde_asignacion,
)
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel

# Import entre módulos de dominio (apps.personal, apps.cargos, apps.catalogos,
# apps.organizacion) en la capa infrastructure: mismo patrón ya establecido
# en `apps.reportes.infrastructure.repositories.repo_reportes_orm` y
# `apps.autogestion.infrastructure.repositories.repo_autogestion_orm` — la
# transición activo→pasivo orquesta datos de varios módulos por diseño
# (ver PLAN_REPARACION_GATH.md, Fase 2.1).
from apps.cargos.domain.services.generacion_codigo import (
    generar_prefijo_nomina,
    siguiente_codigo_especial,
)
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import DireccionGeneralModel
from apps.personal.infrastructure.mappers.mapper_personal import construir_expediente
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContratoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class RepoPasivosORM:
    def listar_pasivos(self, busqueda: str | None = None) -> list[Pasivo]:
        por_cedula: dict[str, Pasivo] = {}

        qs_egresados = (
            EmployeeEgresadoModel.objects.select_related('employee', 'motivo_egreso').all()
            .order_by('-fecha_egreso')
        )
        if busqueda:
            qs_egresados = qs_egresados.filter(
                Q(employee__cedulaidentidad__icontains=busqueda)
                | Q(employee__nombres__icontains=busqueda)
                | Q(employee__apellidos__icontains=busqueda)
            )
        for fila in qs_egresados:
            por_cedula[str(fila.employee_id)] = pasivo_a_entidad(fila)

        # Criterio real del legado (`list_employees_pasive`): un pasivo con
        # nómina activa es un `AsigTrabajo` de `Tipo_personal=PASIVO`, no
        # necesariamente un `EmployeeEgresado` (ese solo existe si el egreso
        # se acompañó de `liberar_activos=True`). Se sobreescribe el registro
        # de arriba porque esta fuente es la vigente/operativa.
        qs_asignaciones = (
            AsigTrabajoModel.objects.select_related('employee', 'tiponominaid')
            .filter(Tipo_personal__tipo_personal__iexact='PASIVO', employee__isnull=False)
            .order_by('-fecha_actualizacion')
        )
        if busqueda:
            qs_asignaciones = qs_asignaciones.filter(
                Q(employee__cedulaidentidad__icontains=busqueda)
                | Q(employee__nombres__icontains=busqueda)
                | Q(employee__apellidos__icontains=busqueda)
            )
        for asig in qs_asignaciones:
            por_cedula[str(asig.employee_id)] = pasivo_desde_asignacion(asig)

        return list(por_cedula.values())

    def obtener_por_cedula(self, cedula: str) -> Pasivo | None:
        # Expediente anidado (Fase 2.1/2.2 del plan de reparación): un pasivo
        # también es un `Employee`, así que el detalle reutiliza el mismo
        # armado de expediente que `apps.personal` (sin duplicar la consulta).
        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        expediente = construir_expediente(empleado) if empleado else None

        asignacion = (
            AsigTrabajoModel.objects.select_related('employee', 'tiponominaid')
            .filter(Tipo_personal__tipo_personal__iexact='PASIVO', employee_id=cedula)
            .order_by('-fecha_actualizacion')
            .first()
        )
        if asignacion:
            return pasivo_desde_asignacion(asignacion, expediente=expediente)

        fila = (
            EmployeeEgresadoModel.objects.select_related('employee', 'motivo_egreso')
            .filter(employee__cedulaidentidad=cedula)
            .first()
        )
        return pasivo_a_entidad(fila, expediente=expediente) if fila else None

    @transaction.atomic
    def procesar_egreso_a_pasivo(
        self,
        cedula: str,
        motivo_movimiento_id: int,
        tipo_nomina_id: int,
        liberar_activos: bool,
        usuario_id: int | None = None,
    ) -> Pasivo:
        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not empleado:
            raise NotFoundError(f"Empleado con cédula {cedula} no encontrado.")

        try:
            motivo = TipoMovimientoModel.objects.get(pk=motivo_movimiento_id)
        except TipoMovimientoModel.DoesNotExist as exc:
            raise NotFoundError(f"Motivo de movimiento {motivo_movimiento_id} no encontrado.") from exc

        try:
            tipo_nomina = TipoNominaModel.objects.get(pk=tipo_nomina_id)
        except TipoNominaModel.DoesNotExist as exc:
            raise NotFoundError(f"Tipo de nómina {tipo_nomina_id} no encontrado.") from exc

        ultima_asig = (
            AsigTrabajoModel.objects.filter(employee=empleado).order_by('-fecha_actualizacion').first()
        )
        if not ultima_asig:
            raise ValidationError('El empleado no tiene cargos previos para realizar el pase a pasivo.')

        try:
            estatus_activo = EstatusModel.objects.get(estatus__iexact='ACTIVO')
            tipo_pasivo = TipoPersonalModel.objects.get(tipo_personal__iexact='PASIVO')
        except (EstatusModel.DoesNotExist, TipoPersonalModel.DoesNotExist) as exc:
            raise ValidationError(f"Error de configuración de catálogos: {exc}") from exc

        if liberar_activos:
            self._cerrar_expediente_activo(empleado)
            try:
                estatus_vacante = EstatusModel.objects.get(estatus__iexact='VACANTE')
            except EstatusModel.DoesNotExist as exc:
                raise ValidationError("El estatus 'VACANTE' no está configurado en el sistema.") from exc
            for asig in AsigTrabajoModel.objects.filter(employee=empleado):
                asig.estatusid = estatus_vacante
                asig.employee = None
                asig.save(update_fields=['estatusid', 'employee', 'fecha_actualizacion'])

        codigo_nuevo = self._generar_codigo_pasivo(tipo_nomina)
        dg_humana = DireccionGeneralModel.objects.filter(
            direccion_general__iexact='OFICINA DE GESTION HUMANA'
        ).first()

        nueva_asig = AsigTrabajoModel.objects.create(
            employee=empleado,
            codigo=codigo_nuevo,
            denominacioncargoid=ultima_asig.denominacioncargoid,
            denominacioncargoespecificoid=ultima_asig.denominacioncargoespecificoid,
            tiponominaid=tipo_nomina,
            estatusid=estatus_activo,
            Tipo_personal=tipo_pasivo,
            Dependencia=dg_humana.dependenciaId if dg_humana else None,
            DireccionGeneral=dg_humana,
            OrganismoAdscritoid=ultima_asig.OrganismoAdscritoid,
            observaciones=f"Cargo pasivo generado. {motivo.movimiento}",
        )

        # Fase 2.5 del plan de reparación: cierra el gap que quedó
        # documentado hasta ahora, reutilizando el mismo evento que emite
        # `RepoCargosORM.asignar_cargo_a_empleado` — `apps.movimientos` no
        # distingue de qué módulo vino el cambio de cargo.
        # `ejecutar_creacion_sobrevivientes` (alta de un familiar como nuevo
        # empleado pensionado por sobrevivencia) sigue deliberadamente fuera
        # de este alcance: es una feature separada y más grande.
        if usuario_id is not None:
            events.cargo_movimiento_ejecutado.send(
                sender=RepoPasivosORM,
                cargo_id=nueva_asig.pk,
                cedula=cedula,
                tipo_movimiento='EGRESO',
                motivo_id=motivo_movimiento_id,
                usuario_id=usuario_id,
            )

        return pasivo_desde_asignacion(nueva_asig)

    def _cerrar_expediente_activo(self, empleado: EmployeeModel) -> None:
        antecedente_activo = AntecedenteServicioModel.objects.filter(
            empleado=empleado, fecha_egreso__isnull=True
        ).first()
        if not antecedente_activo:
            return

        antecedente_activo.fecha_egreso = timezone.now().date()
        antecedente_activo.save(update_fields=['fecha_egreso'])

        contrato = ContratoModel.objects.filter(antecedente=antecedente_activo).first()
        if contrato:
            try:
                estatus_vencido = EstatusModel.objects.get(estatus__iexact='VENCIDO')
            except EstatusModel.DoesNotExist as exc:
                raise ValidationError("El estatus 'VENCIDO' no está configurado en el sistema.") from exc
            contrato.estatus = estatus_vencido
            contrato.save(update_fields=['estatus'])

    def _generar_codigo_pasivo(self, tipo_nomina: TipoNominaModel) -> str:
        prefijo = generar_prefijo_nomina(tipo_nomina.nomina)
        ultimo = (
            AsigTrabajoModel.objects.filter(codigo__startswith=prefijo)
            .order_by('-codigo')
            .values_list('codigo', flat=True)
            .first()
        )
        codigo = siguiente_codigo_especial(prefijo, ultimo)
        if AsigTrabajoModel.objects.filter(codigo=codigo).exists():
            raise ConflictError(f"El código generado {codigo} ya está en uso.")
        return codigo
