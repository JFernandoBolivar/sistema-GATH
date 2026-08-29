"""
Repositorio ORM de Cargos (Reglas B4, B7, D-09).
"""
from django.db import transaction

from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from apps.cargos.domain import events
from apps.cargos.domain.entities.cargo_asignacion import CargoAsignacion
from apps.cargos.domain.entities.denominacion_cargo import DenominacionCargo
from apps.cargos.domain.entities.denominacion_especifica import DenominacionEspecifica
from apps.cargos.domain.services.generacion_codigo import (
    generar_prefijo_nomina,
    siguiente_codigo_especial,
)
from apps.cargos.infrastructure.mappers.mapper_cargos import (
    cargo_asignacion_a_entidad,
    denominacion_a_entidad,
    denominacion_especifica_a_entidad,
)
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.cargos.infrastructure.repositories.repo_prestamos_cargo_orm import RepoPrestamosCargoORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)

ESTATUS_PERMITIDOS_GESTION = ('SUSPENDIDO', 'BLOQUEADO', 'ACTIVO')


class RepoCargosORM(RepoPrestamosCargoORM):
    def listar_denominaciones(self) -> list[DenominacionCargo]:
        qs = DenominacionCargoModel.objects.all().order_by('cargo')
        return [denominacion_a_entidad(d) for d in qs]

    def crear_denominacion(self, nombre: str, orden: int) -> DenominacionCargo:
        fila = DenominacionCargoModel.objects.create(cargo=nombre, orden_by_cargo=orden)
        return denominacion_a_entidad(fila)

    def actualizar_denominacion(self, denominacion_id: int, nombre: str, orden: int) -> DenominacionCargo:
        fila = DenominacionCargoModel.objects.get(pk=denominacion_id)
        fila.cargo = nombre
        fila.orden_by_cargo = orden
        fila.save(update_fields=['cargo', 'orden_by_cargo'])
        return denominacion_a_entidad(fila)

    def eliminar_denominacion(self, denominacion_id: int) -> None:
        DenominacionCargoModel.objects.filter(pk=denominacion_id).delete()

    def listar_denominaciones_especificas(self) -> list[DenominacionEspecifica]:
        qs = DenominacionCargoEspecificoModel.objects.all().order_by('cargo')
        return [denominacion_especifica_a_entidad(d) for d in qs]

    def crear_denominacion_especifica(self, nombre: str, orden: int) -> DenominacionEspecifica:
        fila = DenominacionCargoEspecificoModel.objects.create(cargo=nombre, orden_by_cargo=orden)
        return denominacion_especifica_a_entidad(fila)

    def actualizar_denominacion_especifica(self, denominacion_id: int, nombre: str, orden: int) -> DenominacionEspecifica:
        fila = DenominacionCargoEspecificoModel.objects.get(pk=denominacion_id)
        fila.cargo = nombre
        fila.orden_by_cargo = orden
        fila.save(update_fields=['cargo', 'orden_by_cargo'])
        return denominacion_especifica_a_entidad(fila)

    def eliminar_denominacion_especifica(self, denominacion_id: int) -> None:
        DenominacionCargoEspecificoModel.objects.filter(pk=denominacion_id).delete()

    def listar_cargos(
        self,
        tipo_nomina_id: int | None = None,
        dependencia_id: int | None = None,
        solo_vacantes: bool = False,
    ) -> list[CargoAsignacion]:
        qs = (
            AsigTrabajoModel.objects.select_related(
                'denominacioncargoid',
                'denominacioncargoespecificoid',
                'tiponominaid',
                'estatusid',
                'Dependencia',
                'DireccionGeneral',
                'DireccionLinea',
                'Coordinacion',
            )
            .all()
            .order_by('-fecha_actualizacion')
        )
        if tipo_nomina_id is not None:
            qs = qs.filter(tiponominaid_id=tipo_nomina_id)
        if dependencia_id is not None:
            qs = qs.filter(Dependencia_id=dependencia_id)
        if solo_vacantes:
            qs = qs.filter(employee__isnull=True)
        return [cargo_asignacion_a_entidad(c) for c in qs]

    def obtener_cargo(self, cargo_id: int) -> CargoAsignacion | None:
        fila = (
            AsigTrabajoModel.objects.select_related(
                'denominacioncargoid',
                'denominacioncargoespecificoid',
                'tiponominaid',
                'estatusid',
                'Dependencia',
                'DireccionGeneral',
                'DireccionLinea',
                'Coordinacion',
            )
            .filter(pk=cargo_id)
            .first()
        )
        return cargo_asignacion_a_entidad(fila) if fila else None

    @transaction.atomic
    def asignar_cargo_a_empleado(
        self, cargo_id: int, cedula: str, motivo_id: int | None = None, usuario_id: int | None = None
    ) -> CargoAsignacion:
        fila = AsigTrabajoModel.objects.filter(pk=cargo_id).first()
        if not fila:
            raise NotFoundError(f"Cargo con id {cargo_id} no encontrado")
        if fila.employee_id is not None:
            raise ConflictError('Este código ya está ocupado por el empleado.')

        # Paridad con el legado (`EmployeeAssignmentSerializer.update`):
        # asignar transiciona el estatus a ACTIVO.
        try:
            estatus_activo = EstatusModel.objects.get(estatus__iexact='ACTIVO')
        except EstatusModel.DoesNotExist as exc:
            raise ValidationError("El estatus 'ACTIVO' no está configurado en el sistema.") from exc

        fila.employee_id = cedula
        fila.estatusid = estatus_activo
        fila.save(update_fields=['employee', 'estatusid', 'fecha_actualizacion'])

        # Fase 2.5 del plan de reparación: cierra el gap documentado hasta
        # ahora (el legado registraba esto vía
        # `RAC/services/constants_historial.py::registrar_historial_movimiento`).
        # `usuario_id` es opcional para no romper llamadores sin contexto de
        # usuario (tests, scripts internos); las vistas HTTP siempre lo pasan.
        if usuario_id is not None:
            events.cargo_movimiento_ejecutado.send(
                sender=RepoCargosORM,
                cargo_id=fila.pk,
                cedula=cedula,
                tipo_movimiento='INGRESO',
                motivo_id=motivo_id,
                usuario_id=usuario_id,
            )

        return self.obtener_cargo(cargo_id)

    @transaction.atomic
    def desasignar_cargo(
        self, cargo_id: int, motivo_id: int | None = None, usuario_id: int | None = None
    ) -> CargoAsignacion:
        fila = AsigTrabajoModel.objects.filter(pk=cargo_id).first()
        if not fila:
            raise NotFoundError(f"Cargo con id {cargo_id} no encontrado")
        cedula_anterior = fila.employee_id
        fila.employee_id = None
        fila.save(update_fields=['employee', 'fecha_actualizacion'])

        if usuario_id is not None and cedula_anterior is not None:
            events.cargo_movimiento_ejecutado.send(
                sender=RepoCargosORM,
                cargo_id=fila.pk,
                cedula=cedula_anterior,
                tipo_movimiento='CAMBIO DE ESTATUS',
                motivo_id=motivo_id,
                usuario_id=usuario_id,
            )

        return self.obtener_cargo(cargo_id)

    # ------------------------------------------------------------------
    # Cargo especial (gap #3) y gestión del código de asignación (gap #5)
    # ------------------------------------------------------------------
    def obtener_nombre_tipo_nomina(self, tipo_nomina_id: int) -> str:
        try:
            return TipoNominaModel.objects.get(pk=tipo_nomina_id).nomina
        except TipoNominaModel.DoesNotExist as exc:
            raise NotFoundError(f"Tipo de nómina {tipo_nomina_id} no encontrado") from exc

    def generar_siguiente_codigo_especial(self, prefijo: str) -> str:
        ultimo = (
            AsigTrabajoModel.objects.filter(codigo__startswith=prefijo)
            .order_by('-codigo')
            .values_list('codigo', flat=True)
            .first()
        )
        return siguiente_codigo_especial(prefijo, ultimo)

    @transaction.atomic
    def crear_cargo_especial_y_asignar(self, datos: dict) -> CargoAsignacion:
        tipo_nomina = TipoNominaModel.objects.filter(pk=datos['tipo_nomina_id']).first()
        if not tipo_nomina:
            raise NotFoundError(f"Tipo de nómina {datos['tipo_nomina_id']} no encontrado")
        if not tipo_nomina.requiere_codig:
            raise ValidationError(
                'Esta nómina no permite generación automática de códigos especiales.'
            )

        try:
            estatus_activo = EstatusModel.objects.get(estatus__iexact='ACTIVO')
            tipo_personal_activo = TipoPersonalModel.objects.get(tipo_personal__iexact='ACTIVO')
        except (EstatusModel.DoesNotExist, TipoPersonalModel.DoesNotExist) as exc:
            raise ValidationError(f"Error de configuración: {exc}") from exc

        prefijo = generar_prefijo_nomina(tipo_nomina.nomina)
        codigo = self.generar_siguiente_codigo_especial(prefijo)

        fila = AsigTrabajoModel.objects.create(
            codigo=codigo,
            employee_id=datos['cedula_empleado'],
            denominacioncargoid_id=datos['denominacion_id'],
            denominacioncargoespecificoid_id=datos['especifica_id'],
            tiponominaid=tipo_nomina,
            estatusid=estatus_activo,
            Tipo_personal=tipo_personal_activo,
            Dependencia_id=datos.get('dependencia_id'),
            DireccionGeneral_id=datos.get('direccion_general_id'),
            DireccionLinea_id=datos.get('direccion_linea_id'),
            Coordinacion_id=datos.get('coordinacion_id'),
            OrganismoAdscritoid_id=datos.get('organismo_id'),
            gradoid_id=datos.get('grado_id'),
            observaciones=datos.get('observaciones') or '',
        )

        usuario_id = datos.get('usuario_id')
        if usuario_id is not None:
            events.cargo_movimiento_ejecutado.send(
                sender=RepoCargosORM,
                cargo_id=fila.pk,
                cedula=datos['cedula_empleado'],
                tipo_movimiento='INGRESO',
                motivo_id=datos.get('motivo_id'),
                usuario_id=usuario_id,
            )

        return self.obtener_cargo(fila.pk)

    # ------------------------------------------------------------------
    # Fase 2.5 del plan de reparación — traslado, estatus, encargaduría
    # ------------------------------------------------------------------
    @transaction.atomic
    def cambiar_cargo(
        self, cargo_actual_id: int, cargo_nuevo_id: int, motivo_id: int, usuario_id: int
    ) -> CargoAsignacion:
        """Réplica funcional de `MovimintoCargoSerializer.update` (legado)."""
        actual = AsigTrabajoModel.objects.select_for_update().filter(pk=cargo_actual_id).first()
        if not actual:
            raise NotFoundError(f"Cargo con id {cargo_actual_id} no encontrado")
        if actual.employee_id is None:
            raise ValidationError('El cargo actual no tiene un empleado asignado para trasladar.')

        nuevo = AsigTrabajoModel.objects.select_for_update().filter(pk=cargo_nuevo_id).first()
        if not nuevo:
            raise NotFoundError(f"Cargo con id {cargo_nuevo_id} no encontrado")

        try:
            estatus_vacante = EstatusModel.objects.get(estatus__iexact='VACANTE')
            estatus_activo = EstatusModel.objects.get(estatus__iexact='ACTIVO')
        except EstatusModel.DoesNotExist as exc:
            raise ValidationError('Los estatus VACANTE/ACTIVO no están configurados en el sistema.') from exc

        if nuevo.estatusid_id != estatus_vacante.pk:
            raise ConflictError('El cargo seleccionado ya está ocupado.')

        try:
            motivo = TipoMovimientoModel.objects.get(pk=motivo_id)
        except TipoMovimientoModel.DoesNotExist as exc:
            raise NotFoundError(f"Motivo de movimiento {motivo_id} no encontrado.") from exc

        empleado_cedula = actual.employee_id

        actual.employee_id = None
        actual.estatusid = estatus_vacante
        actual.save(update_fields=['employee', 'estatusid', 'fecha_actualizacion'])

        nuevo.employee_id = empleado_cedula
        nuevo.estatusid = estatus_activo
        nuevo.observaciones = motivo.movimiento
        nuevo.save(update_fields=['employee', 'estatusid', 'observaciones', 'fecha_actualizacion'])

        events.cargo_movimiento_ejecutado.send(
            sender=RepoCargosORM,
            cargo_id=nuevo.pk,
            cedula=empleado_cedula,
            tipo_movimiento='TRASLADO',
            motivo_id=motivo_id,
            usuario_id=usuario_id,
        )

        return self.obtener_cargo(nuevo.pk)

    @transaction.atomic
    def gestionar_estatus_puesto(
        self, cargo_id: int, estatus_id: int, motivo_id: int, usuario_id: int
    ) -> CargoAsignacion:
        """Réplica funcional de `GestionStatusSerializer.update` (legado)."""
        fila = AsigTrabajoModel.objects.select_for_update().filter(pk=cargo_id).first()
        if not fila:
            raise NotFoundError(f"Cargo con id {cargo_id} no encontrado")

        try:
            nuevo_estatus = EstatusModel.objects.get(pk=estatus_id)
        except EstatusModel.DoesNotExist as exc:
            raise NotFoundError(f"Estatus {estatus_id} no encontrado.") from exc

        if nuevo_estatus.estatus.upper() not in ESTATUS_PERMITIDOS_GESTION:
            raise ValidationError('Gestión de estatus no permitida para este valor.')
        if fila.estatusid_id == nuevo_estatus.pk:
            raise ConflictError(f"El cargo ya se encuentra en estatus '{nuevo_estatus.estatus}'.")

        try:
            motivo = TipoMovimientoModel.objects.get(pk=motivo_id)
        except TipoMovimientoModel.DoesNotExist as exc:
            raise NotFoundError(f"Motivo de movimiento {motivo_id} no encontrado.") from exc

        fila.estatusid = nuevo_estatus
        fila.observaciones = motivo.movimiento
        fila.save(update_fields=['estatusid', 'observaciones', 'fecha_actualizacion'])

        if fila.employee_id is not None:
            events.cargo_movimiento_ejecutado.send(
                sender=RepoCargosORM,
                cargo_id=fila.pk,
                cedula=fila.employee_id,
                tipo_movimiento='CAMBIO DE ESTATUS',
                motivo_id=motivo_id,
                usuario_id=usuario_id,
            )

        return self.obtener_cargo(cargo_id)

    # El subsistema de préstamo/encargaduría (`listar_prestamos`,
    # `crear_prestamo`, `finalizar_prestamo`) se implementa en
    # `RepoPrestamosCargoORM` (heredado más abajo) — separado por el techo
    # de 400 líneas por archivo (Regla B13).
