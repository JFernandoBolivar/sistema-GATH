"""
Repositorio ORM de Cargos (Reglas B4, B7, D-09).
"""
from django.db import transaction

from core.domain.catalogos import (
    ESTATUS_ACTIVO,
    ESTATUS_BLOQUEADO,
    ESTATUS_SUSPENDIDO,
    ESTATUS_VACANTE,
    TIPO_PERSONAL_ACTIVO,
    TIPO_PERSONAL_PASIVO,
)
from core.domain.categorias_motivo import Operacion
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from apps.catalogos.infrastructure.repositories.motivos_por_categoria import (
    obtener_motivo_de_operacion,
    validar_motivo_opcional,
)
from apps.cargos.domain import events
from apps.cargos.domain.entities.cargo_asignacion import CargoAsignacion
from apps.cargos.domain.entities.denominacion_cargo import DenominacionCargo
from apps.cargos.domain.entities.denominacion_especifica import DenominacionEspecifica
from apps.cargos.domain.services.generacion_codigo import (
    generar_codigo_normal,
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
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
)

ESTATUS_PERMITIDOS_GESTION = (ESTATUS_SUSPENDIDO, ESTATUS_BLOQUEADO, ESTATUS_ACTIVO)


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
        direccion_general_id: int | None = None,
        direccion_linea_id: int | None = None,
        coordinacion_id: int | None = None,
        codigo: str | None = None,
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
                'OrganismoAdscritoid',
                'gradoid',
                'employee',
            )
            # Gestión de personal activo: los puestos de pasivos (P_…, tipo de
            # personal PASIVO) se gestionan en el módulo de Pasivos.
            .exclude(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO)
            .order_by('-fecha_actualizacion')
        )
        if tipo_nomina_id is not None:
            qs = qs.filter(tiponominaid_id=tipo_nomina_id)
        if dependencia_id is not None:
            qs = qs.filter(Dependencia_id=dependencia_id)
        if direccion_general_id is not None:
            qs = qs.filter(DireccionGeneral_id=direccion_general_id)
        if direccion_linea_id is not None:
            qs = qs.filter(DireccionLinea_id=direccion_linea_id)
        if coordinacion_id is not None:
            qs = qs.filter(Coordinacion_id=coordinacion_id)
        if codigo:
            qs = qs.filter(codigo__icontains=codigo)
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
                'employee',
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
        validar_motivo_opcional(motivo_id, Operacion.ASIGNAR_CARGO)

        # Paridad con el legado (`EmployeeAssignmentSerializer.update`):
        # asignar transiciona el estatus a ACTIVO.
        try:
            estatus_activo = EstatusModel.objects.get(estatus__iexact=ESTATUS_ACTIVO)
        except EstatusModel.DoesNotExist as exc:
            raise ValidationError("El estatus 'ACTIVO' no está configurado en el sistema.") from exc

        fila.employee_id = cedula
        fila.estatusid = estatus_activo
        campos = ['employee', 'estatusid', 'fecha_actualizacion']
        # Códigos creados antes de corregir `crear_cargo` quedaron sin tipo de
        # personal: al ocuparlos por personal activo se completa.
        if fila.Tipo_personal_id is None:
            tipo_activo = TipoPersonalModel.objects.filter(tipo_personal__iexact=TIPO_PERSONAL_ACTIVO).first()
            if tipo_activo is not None:
                fila.Tipo_personal = tipo_activo
                campos.append('Tipo_personal')
        fila.save(update_fields=campos)

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
                origen=events.ORIGEN_CARGOS,
            )

        return self.obtener_cargo(cargo_id)

    @transaction.atomic
    def desasignar_cargo(
        self, cargo_id: int, motivo_id: int | None = None, usuario_id: int | None = None
    ) -> CargoAsignacion:
        fila = AsigTrabajoModel.objects.filter(pk=cargo_id).first()
        if not fila:
            raise NotFoundError(f"Cargo con id {cargo_id} no encontrado")
        validar_motivo_opcional(motivo_id, Operacion.DESASIGNAR_CARGO)
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
                origen=events.ORIGEN_CARGOS,
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

    def _codigo_para(self, datos: dict) -> str:
        """Código normal que corresponde a la ubicación y al cargo (sin crear)."""
        denominacion = DenominacionCargoModel.objects.filter(
            pk=datos.get('denominacion_id'),
        ).first()
        if not denominacion:
            raise NotFoundError(
                f"Denominación de cargo {datos.get('denominacion_id')} no encontrada"
            )

        dependencia_id = datos.get('dependencia_id')
        direccion_general_id = datos.get('direccion_general_id')
        direccion_linea_id = datos.get('direccion_linea_id')
        coordinacion_id = datos.get('coordinacion_id')

        codigo_dependencia = (
            DependenciaModel.objects.filter(pk=dependencia_id).values_list('Codigo', flat=True).first()
            if dependencia_id else None
        )
        codigo_direccion_general = (
            DireccionGeneralModel.objects.filter(pk=direccion_general_id).values_list('Codigo', flat=True).first()
            if direccion_general_id else None
        )
        codigo_direccion_linea = (
            DireccionLineaModel.objects.filter(pk=direccion_linea_id).values_list('Codigo', flat=True).first()
            if direccion_linea_id else None
        )
        codigo_coordinacion = (
            CoordinacionModel.objects.filter(pk=coordinacion_id).values_list('Codigo', flat=True).first()
            if coordinacion_id else None
        )

        prefijo_6 = (codigo_coordinacion or codigo_direccion_linea or codigo_direccion_general or codigo_dependencia or '')[:6].zfill(6) if (
            codigo_coordinacion or codigo_direccion_linea or codigo_direccion_general or codigo_dependencia
        ) else None
        sufijos_usados: set[int] = set()
        if prefijo_6:
            codigos_en_ubicacion = AsigTrabajoModel.objects.filter(
                codigo__startswith=prefijo_6
            ).values_list('codigo', flat=True)
            sufijos_usados = {
                int(c[6:8]) for c in codigos_en_ubicacion if len(c) >= 8 and c[6:8].isdigit()
            }

        try:
            return generar_codigo_normal(
                codigo_coordinacion=codigo_coordinacion,
                codigo_direccion_linea=codigo_direccion_linea,
                codigo_direccion_general=codigo_direccion_general,
                codigo_dependencia=codigo_dependencia,
                nombre_cargo=denominacion.cargo,
                sufijos_ya_usados_en_ubicacion=sufijos_usados,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    def previsualizar_codigo(self, datos: dict) -> str:
        """Código que generará `crear_cargo` para estos datos (sin escribir)."""
        return self._codigo_para(datos)

    @transaction.atomic
    def crear_cargo(self, datos: dict) -> CargoAsignacion:
        """
        Crea un código de posición VACANTE (sin empleado asignado), réplica
        funcional de la pantalla "Crear Nuevo Código" del legado. Usa el
        esquema de código NORMAL (6 dígitos de ubicación + 2 de tipo de
        cargo) en vez del prefijo especial de `crear_cargo_especial_y_asignar`.
        """
        denominacion = DenominacionCargoModel.objects.filter(pk=datos['denominacion_id']).first()
        if not denominacion:
            raise NotFoundError(f"Denominación de cargo {datos['denominacion_id']} no encontrada")
        if not TipoNominaModel.objects.filter(pk=datos['tipo_nomina_id']).exists():
            raise NotFoundError(f"Tipo de nómina {datos['tipo_nomina_id']} no encontrado")

        try:
            estatus_vacante = EstatusModel.objects.get(estatus__iexact=ESTATUS_VACANTE)
            tipo_personal_activo = TipoPersonalModel.objects.get(tipo_personal__iexact=TIPO_PERSONAL_ACTIVO)
        except (EstatusModel.DoesNotExist, TipoPersonalModel.DoesNotExist) as exc:
            raise ValidationError(f"Error de configuración: {exc}") from exc

        codigo = self._codigo_para(datos)
        dependencia_id = datos.get('dependencia_id')
        direccion_general_id = datos.get('direccion_general_id')
        direccion_linea_id = datos.get('direccion_linea_id')
        coordinacion_id = datos.get('coordinacion_id')

        fila = AsigTrabajoModel.objects.create(
            codigo=codigo,
            employee=None,
            denominacioncargoid_id=datos['denominacion_id'],
            denominacioncargoespecificoid_id=datos['especifica_id'],
            tiponominaid_id=datos['tipo_nomina_id'],
            estatusid=estatus_vacante,
            # Los códigos creados desde Gestión de personal activo son de personal
            # ACTIVO: sin este dato el historial de movimientos no puede registrarse.
            Tipo_personal=tipo_personal_activo,
            Dependencia_id=dependencia_id,
            DireccionGeneral_id=direccion_general_id,
            DireccionLinea_id=direccion_linea_id,
            Coordinacion_id=coordinacion_id,
            OrganismoAdscritoid_id=datos.get('organismo_id'),
            gradoid_id=datos.get('grado_id'),
            observaciones=datos.get('observaciones') or '',
        )
        return self.obtener_cargo(fila.pk)

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
            estatus_activo = EstatusModel.objects.get(estatus__iexact=ESTATUS_ACTIVO)
            tipo_personal_activo = TipoPersonalModel.objects.get(tipo_personal__iexact=TIPO_PERSONAL_ACTIVO)
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
                origen=events.ORIGEN_CARGOS,
            )

        return self.obtener_cargo(fila.pk)

    @transaction.atomic
    def actualizar_cargo(
        self, cargo_id: int, datos: dict, usuario_id: int | None = None
    ) -> CargoAsignacion:
        fila = AsigTrabajoModel.objects.select_for_update().filter(pk=cargo_id).first()
        if not fila:
            raise NotFoundError(f"Cargo con id {cargo_id} no encontrado")

        # Punto de Cuenta automático (RN-006-01): se captura ANTES de aplicar
        # los cambios para poder comparar luego de guardar. Un cambio de
        # denominación/nómina/grado/organismo dentro de la misma Dependencia
        # NO dispara nada -- solo un cambio real de Dependencia lo hace.
        dependencia_id_anterior = fila.Dependencia_id
        oficina_id_anterior = fila.DireccionGeneral_id

        if 'denominacioncargoid' in datos and datos['denominacioncargoid']:
            fila.denominacioncargoid_id = datos['denominacioncargoid']
        if 'denominacioncargoespecificoid' in datos and datos['denominacioncargoespecificoid']:
            fila.denominacioncargoespecificoid_id = datos['denominacioncargoespecificoid']
        if 'tiponominaid' in datos and datos['tiponominaid']:
            fila.tiponominaid_id = datos['tiponominaid']
        if 'gradoid' in datos:
            fila.gradoid_id = datos['gradoid'] if datos['gradoid'] and datos['gradoid'] > 0 else None
        if 'OrganismoAdscritoid' in datos:
            fila.OrganismoAdscritoid_id = datos['OrganismoAdscritoid'] if datos['OrganismoAdscritoid'] and datos['OrganismoAdscritoid'] > 0 else None
        if 'Dependencia' in datos:
            fila.Dependencia_id = datos['Dependencia'] if datos['Dependencia'] and datos['Dependencia'] > 0 else None
        if 'DireccionGeneral' in datos:
            fila.DireccionGeneral_id = datos['DireccionGeneral'] if datos['DireccionGeneral'] and datos['DireccionGeneral'] > 0 else None
        if 'DireccionLinea' in datos:
            fila.DireccionLinea_id = datos['DireccionLinea'] if datos['DireccionLinea'] and datos['DireccionLinea'] > 0 else None
        if 'Coordinacion' in datos:
            fila.Coordinacion_id = datos['Coordinacion'] if datos['Coordinacion'] and datos['Coordinacion'] > 0 else None

        if fila.Tipo_personal_id is None:
            tipo_activo = TipoPersonalModel.objects.filter(tipo_personal__iexact=TIPO_PERSONAL_ACTIVO).first()
            if tipo_activo is not None:
                fila.Tipo_personal = tipo_activo

        fila.save()

        if fila.DireccionGeneral_id != oficina_id_anterior and fila.employee_id is not None:
            events.cargo_dependencia_cambiada.send(
                sender=RepoCargosORM,
                cargo_id=fila.pk,
                cedula=fila.employee_id,
                dependencia_anterior_id=dependencia_id_anterior,
                dependencia_nueva_id=fila.Dependencia_id,
                oficina_anterior_id=oficina_id_anterior,
                oficina_nueva_id=fila.DireccionGeneral_id,
                motivo_id=datos.get('motivo_id'),
                usuario_id=usuario_id,
            )

        return self.obtener_cargo(cargo_id)

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
            estatus_vacante = EstatusModel.objects.get(estatus__iexact=ESTATUS_VACANTE)
            estatus_activo = EstatusModel.objects.get(estatus__iexact=ESTATUS_ACTIVO)
        except EstatusModel.DoesNotExist as exc:
            raise ValidationError('Los estatus VACANTE/ACTIVO no están configurados en el sistema.') from exc

        if nuevo.estatusid_id != estatus_vacante.pk:
            raise ConflictError('El cargo seleccionado ya está ocupado.')

        motivo = obtener_motivo_de_operacion(motivo_id, Operacion.CAMBIAR_CARGO)

        empleado_cedula = actual.employee_id
        # Oficina del cargo que deja (antes de heredar contexto al nuevo).
        oficina_anterior_id = actual.DireccionGeneral_id

        actual.employee_id = None
        actual.estatusid = estatus_vacante
        actual.save(update_fields=['employee', 'estatusid', 'fecha_actualizacion'])

        nuevo.employee_id = empleado_cedula
        nuevo.estatusid = estatus_activo
        nuevo.observaciones = motivo.movimiento
        campos_actualizados = ['employee', 'estatusid', 'observaciones', 'fecha_actualizacion']
        # Un código vacante puede haberse creado sin contexto organizativo. Al
        # ocuparlo, hereda el del cargo que deja el empleado: la tabla física
        # `EmployeeMovementHistory` exige tipo de personal y dependencia.
        if nuevo.Tipo_personal_id is None and actual.Tipo_personal_id is not None:
            nuevo.Tipo_personal = actual.Tipo_personal
            campos_actualizados.append('Tipo_personal')
        if nuevo.Dependencia_id is None and actual.Dependencia_id is not None:
            nuevo.Dependencia = actual.Dependencia
            campos_actualizados.append('Dependencia')
        if nuevo.DireccionGeneral_id is None and actual.DireccionGeneral_id is not None:
            nuevo.DireccionGeneral = actual.DireccionGeneral
            campos_actualizados.append('DireccionGeneral')
        if nuevo.DireccionLinea_id is None and actual.DireccionLinea_id is not None:
            nuevo.DireccionLinea = actual.DireccionLinea
            campos_actualizados.append('DireccionLinea')
        if nuevo.Coordinacion_id is None and actual.Coordinacion_id is not None:
            nuevo.Coordinacion = actual.Coordinacion
            campos_actualizados.append('Coordinacion')
        nuevo.save(update_fields=campos_actualizados)

        events.cargo_movimiento_ejecutado.send(
            sender=RepoCargosORM,
            cargo_id=nuevo.pk,
            cedula=empleado_cedula,
            tipo_movimiento='TRASLADO',
            # Punto de Cuenta automático (RN-006-01): un traslado mueve al
            # empleado a OTRO código de cargo, cada uno con su propia
            # Dependencia -- `actual`/`nuevo` ya están cargados en memoria,
            # no hace falta ninguna consulta extra para comparar.
            dependencia_anterior_id=actual.Dependencia_id,
            dependencia_nueva_id=nuevo.Dependencia_id,
            oficina_anterior_id=oficina_anterior_id,
            oficina_nueva_id=nuevo.DireccionGeneral_id,
            motivo_id=motivo_id,
            usuario_id=usuario_id,
            origen=events.ORIGEN_CARGOS,
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

        motivo = obtener_motivo_de_operacion(motivo_id, Operacion.CAMBIAR_ESTATUS_PUESTO)

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
                origen=events.ORIGEN_CARGOS,
            )

        return self.obtener_cargo(cargo_id)

    # El subsistema de préstamo/encargaduría (`listar_prestamos`,
    # `crear_prestamo`, `finalizar_prestamo`) se implementa en
    # `RepoPrestamosCargoORM` (heredado más abajo) — separado por el techo
    # de 400 líneas por archivo (Regla B13).
