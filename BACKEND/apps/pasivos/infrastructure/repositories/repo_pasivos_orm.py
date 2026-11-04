"""
Repositorio ORM de Pasivos (Reglas B4, B7, D-09).
"""
from django.db import transaction
from django.db.models import Min, Q
from django.utils import timezone

from core.domain.categorias_motivo import (
    MOTIVO_SISTEMA_JUBILACION,
    MOTIVO_SISTEMA_PENSION_INVALIDEZ,
    Operacion,
)
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from apps.catalogos.infrastructure.repositories.motivos_por_categoria import (
    listar_motivos_de_operacion,
    obtener_motivo_de_operacion,
    obtener_motivo_de_sistema,
)
from apps.cargos.domain import events
from apps.pasivos.domain.entities.pasivo import Pasivo
from apps.pasivos.infrastructure.codigo_pasivo import generar_codigo_pasivo
from apps.pasivos.infrastructure.repositories.repo_sobrevivientes_orm import RepoSobrevivientesORM
from apps.pasivos.infrastructure.mappers.mapper_pasivos import (
    pasivo_a_entidad,
    pasivo_desde_asignacion,
)
from apps.pasivos.infrastructure.models.pasivo_models import (
    CargoEgresadoModel,
    EmployeeEgresadoModel,
)

# Import entre módulos de dominio (apps.personal, apps.cargos, apps.catalogos,
# apps.organizacion) en la capa infrastructure: mismo patrón ya establecido
# en `apps.reportes.infrastructure.repositories.repo_reportes_orm` y
# `apps.autogestion.infrastructure.repositories.repo_autogestion_orm` — la
# transición activo→pasivo orquesta datos de varios módulos por diseño
# (ver PLAN_REPARACION_GATH.md, Fase 2.1).
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.mappers.mapper_personal import construir_expediente
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContratoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel


def _actualizado(empleado) -> str:
    """Última actualización del trabajador, comparable como texto ISO."""
    fecha = getattr(empleado, 'fecha_actualizacion', None)
    return fecha.isoformat() if fecha else ''


class RepoPasivosORM(RepoSobrevivientesORM):
    @staticmethod
    def _cedulas_pasivas_egresadas() -> set[str]:
        """Pasivos dados de baja por fallecimiento (asignación en EGRESADO).

        Esos expedientes se conservan para consulta/histórico, pero ya no son
        parte del personal pasivo vigente y no deben listarse.
        """
        return {
            str(cedula)
            for cedula in AsigTrabajoModel.objects.filter(
                Tipo_personal__tipo_personal__iexact='PASIVO',
                estatusid__estatus__iexact='EGRESADO',
            ).values_list('employee_id', flat=True)
        }

    def listar_pasivos(self, busqueda: str | None = None) -> list[Pasivo]:
        por_cedula: dict[str, Pasivo] = {}
        cesados = self._cedulas_pasivas_egresadas()

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
            if str(fila.employee_id) in cesados:
                continue
            por_cedula[str(fila.employee_id)] = pasivo_a_entidad(fila)

        # Criterio real del legado (`list_employees_pasive`): un pasivo con
        # nómina activa es un `AsigTrabajo` de `Tipo_personal=PASIVO`, no
        # necesariamente un `EmployeeEgresado` (ese solo existe si el egreso
        # se acompañó de `liberar_activos=True`). Se sobreescribe el registro
        # de arriba porque esta fuente es la vigente/operativa.
        qs_asignaciones = (
            AsigTrabajoModel.objects.select_related('employee', 'tiponominaid')
            .filter(Tipo_personal__tipo_personal__iexact='PASIVO', employee__isnull=False)
            .exclude(estatusid__estatus__iexact='EGRESADO')
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


    def listar_pasivos_paginados(
        self,
        *,
        cedula: str | None = None,
        nombre: str | None = None,
        codigo: str | None = None,
        tipo_nomina_id: int | None = None,
        fecha_desde=None,
        fecha_hasta=None,
        limite: int = 10,
        desplazamiento: int = 0,
    ) -> tuple[list[Pasivo], int]:
        """Listado con filtros y paginación en servidor (10/50 por página).

        Rendimiento (2026-11-03): antes se mapeaban TODOS los pasivos a entidades
        (y cada egresado consultaba su historial de cargos) para luego ordenar y
        recortar la página en Python. Ahora se ordena y filtra con la misma fecha
        que ponen los mappers y solo se mapean las filas de la página. El
        resultado es idéntico.
        """
        # cédula -> (fecha_egreso como la expone el mapper, última actualización
        # del trabajador, mapeo diferido). La fecha de egreso filtra; el orden es
        # por última actualización (lo más reciente primero, QA 2026-11-03).
        por_cedula: dict[str, tuple[str, str, object]] = {}
        cesados = self._cedulas_pasivas_egresadas()

        qs_egresados = (
            EmployeeEgresadoModel.objects.select_related('employee', 'employee__sexoid', 'motivo_egreso')
            .annotate(fecha_ingreso_organismo=Min('employee__antecedentes_servicio__fecha_ingreso'))
            .all()
            .order_by('-fecha_egreso')
        )
        if cedula:
            qs_egresados = qs_egresados.filter(employee__cedulaidentidad__icontains=cedula)
        if nombre:
            qs_egresados = qs_egresados.filter(
                Q(employee__nombres__icontains=nombre) | Q(employee__apellidos__icontains=nombre)
            )
        if codigo:
            qs_egresados = qs_egresados.filter(n_contrato__icontains=codigo)
        if tipo_nomina_id:
            # Los egresados no tienen nómina vigente: si se filtra por nómina
            # pasiva, solo cuentan las asignaciones.
            qs_egresados = qs_egresados.none()
        for fila in qs_egresados:
            if str(fila.employee_id) in cesados:
                continue
            por_cedula[str(fila.employee_id)] = (
                str(fila.fecha_egreso), _actualizado(fila.employee), lambda fila=fila: pasivo_a_entidad(fila)
            )

        qs_asignaciones = (
            AsigTrabajoModel.objects.select_related('employee', 'employee__sexoid', 'tiponominaid')
            .filter(Tipo_personal__tipo_personal__iexact='PASIVO', employee__isnull=False)
            .exclude(estatusid__estatus__iexact='EGRESADO')
            .annotate(fecha_ingreso_organismo=Min('employee__antecedentes_servicio__fecha_ingreso'))
            .order_by('-fecha_actualizacion')
        )
        if cedula:
            qs_asignaciones = qs_asignaciones.filter(employee__cedulaidentidad__icontains=cedula)
        if nombre:
            qs_asignaciones = qs_asignaciones.filter(
                Q(employee__nombres__icontains=nombre) | Q(employee__apellidos__icontains=nombre)
            )
        if codigo:
            qs_asignaciones = qs_asignaciones.filter(codigo__icontains=codigo)
        if tipo_nomina_id:
            qs_asignaciones = qs_asignaciones.filter(tiponominaid_id=tipo_nomina_id)
        for asig in qs_asignaciones:
            por_cedula[str(asig.employee_id)] = (
                str(asig.fecha_actualizacion), _actualizado(asig.employee),
                lambda asig=asig: pasivo_desde_asignacion(asig),
            )

        candidatos = list(por_cedula.values())
        if fecha_desde:
            candidatos = [c for c in candidatos if (c[0] or '')[:10] >= str(fecha_desde)]
        if fecha_hasta:
            candidatos = [c for c in candidatos if (c[0] or '')[:10] <= str(fecha_hasta)]
        candidatos.sort(key=lambda c: (c[1], c[0] or ''), reverse=True)
        total = len(candidatos)
        pagina = candidatos[desplazamiento:desplazamiento + limite]
        return [mapear() for _, _, mapear in pagina], total

    def actualizar_datos_pasivo(self, cedula: str, datos: dict) -> Pasivo:
        """Datos básicos editables de un pasivo; reutiliza la actualización de Personal."""
        from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM

        normalizados = dict(datos)
        if 'estado_civil_id' in normalizados:
            normalizados['estadoCivil_id'] = normalizados.pop('estado_civil_id')
        if 'sexo_id' in normalizados:
            normalizados['sexoid_id'] = normalizados.pop('sexo_id')
        RepoPersonalORM().actualizar_empleado(cedula=cedula, datos=normalizados)
        actualizado = self.obtener_por_cedula(cedula)
        if actualizado is None:
            raise NotFoundError(f"Pasivo con cédula {cedula} no encontrado.")
        return actualizado

    def obtener_por_cedula(self, cedula: str) -> Pasivo | None:
        # Expediente anidado (Fase 2.1/2.2 del plan de reparación): un pasivo
        # también es un `Employee`, así que el detalle reutiliza el mismo
        # armado de expediente que `apps.personal` (sin duplicar la consulta).
        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        expediente = construir_expediente(empleado) if empleado else None

        asignacion = (
            AsigTrabajoModel.objects.select_related('employee', 'employee__sexoid', 'tiponominaid')
            .filter(Tipo_personal__tipo_personal__iexact='PASIVO', employee_id=cedula)
            .order_by('-fecha_actualizacion')
            .first()
        )
        if asignacion:
            return pasivo_desde_asignacion(asignacion, expediente=expediente)

        fila = (
            EmployeeEgresadoModel.objects.select_related('employee', 'employee__sexoid', 'motivo_egreso')
            .filter(employee__cedulaidentidad=cedula)
            .first()
        )
        return pasivo_a_entidad(fila, expediente=expediente) if fila else None

    def listar_motivos_egreso_pasivo(self) -> list[dict]:
        """Motivos de la categoría de egreso de pasivo (`Operacion.EGRESO_PASIVO`)."""
        return listar_motivos_de_operacion(Operacion.EGRESO_PASIVO)

    @transaction.atomic
    def egresar_pasivo(
        self,
        cedula: str,
        motivo_id: int,
        usuario_id: int | None = None,
    ) -> Pasivo:
        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not empleado:
            raise NotFoundError(f'Empleado con cédula {cedula} no encontrado.')
        asignacion = (
            AsigTrabajoModel.objects.filter(
                employee=empleado, Tipo_personal__tipo_personal__iexact='PASIVO',
            )
            .order_by('-fecha_actualizacion')
            .first()
        )
        if not asignacion:
            raise NotFoundError(f'La cédula {cedula} no tiene una asignación pasiva vigente.')
        motivo = obtener_motivo_de_operacion(motivo_id, Operacion.EGRESO_PASIVO, campo='motivo_id')
        try:
            estatus_egresado = EstatusModel.objects.get(estatus__iexact='EGRESADO')
        except EstatusModel.DoesNotExist as exc:
            raise ValidationError("El estatus 'EGRESADO' no está configurado.") from exc

        asignacion.estatusid = estatus_egresado
        asignacion.save(update_fields=['estatusid', 'fecha_actualizacion'])

        egreso = EmployeeEgresadoModel.objects.filter(employee=empleado).first()
        if egreso:
            egreso.motivo_egreso = motivo
            egreso.n_contrato = asignacion.codigo
            egreso.save(update_fields=['motivo_egreso', 'n_contrato'])
        else:
            EmployeeEgresadoModel.objects.create(
                employee=empleado,
                n_contrato=asignacion.codigo,
                fechaingresoorganismo=timezone.now().date(),
                motivo_egreso=motivo,
            )

        if usuario_id is not None:
            events.cargo_movimiento_ejecutado.send(
                sender=RepoPasivosORM,
                cargo_id=asignacion.pk,
                cedula=cedula,
                tipo_movimiento='EGRESO',
                motivo_id=motivo.pk,
                usuario_id=usuario_id,
                origen=events.ORIGEN_PASIVOS,
            )
        return pasivo_desde_asignacion(asignacion)

    @transaction.atomic
    def registrar_pasivo_directo(
        self,
        datos: dict,
        tipo_nomina_id: int,
        usuario_id: int | None = None,
    ) -> Pasivo:
        """Alta directa de jubilado/pensionado, sin cargo activo previo."""
        from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM

        tipo_nomina = TipoNominaModel.objects.filter(
            pk=tipo_nomina_id, es_activo=False,
        ).first()
        if not tipo_nomina:
            raise ValidationError(
                'Seleccione un tipo de nómina de pasivos (es_activo=False).'
            )
        cedula = str(datos.get('cedula') or '').strip()
        if not cedula:
            raise ValidationError('La cédula es obligatoria.')
        if EmployeeModel.objects.filter(cedulaidentidad=cedula).exists():
            raise ConflictError(f'La cédula {cedula} ya existe en el sistema.')

        cargo = DenominacionCargoModel.objects.filter(
            cargo__iexact='PERSONAL PASIVO',
        ).first()
        cargo_esp = DenominacionCargoEspecificoModel.objects.filter(
            cargo__iexact='PERSONAL PASIVO',
        ).first()
        dependencia = DependenciaModel.objects.filter(
            dependencia__iexact='NIVEL DE APOYO',
        ).first()
        direccion = DireccionGeneralModel.objects.filter(
            direccion_general__iexact='OFICINA DE GESTION HUMANA',
        ).first()
        if not (cargo and cargo_esp and dependencia and direccion):
            raise ValidationError(
                'No están configurados el cargo PERSONAL PASIVO o la estructura '
                'de la Oficina de Gestión Humana.'
            )
        try:
            estatus = EstatusModel.objects.get(estatus__iexact='PASIVO')
            tipo_pasivo = TipoPersonalModel.objects.get(
                tipo_personal__iexact='PASIVO',
            )
        except (EstatusModel.DoesNotExist, TipoPersonalModel.DoesNotExist) as exc:
            raise ValidationError(
                f'Error de configuración de catálogos: {exc}'
            ) from exc

        RepoPersonalORM().crear_empleado(dict(datos))
        empleado = EmployeeModel.objects.get(cedulaidentidad=cedula)
        asignacion = AsigTrabajoModel.objects.create(
            employee=empleado,
            codigo=generar_codigo_pasivo(tipo_nomina),
            denominacioncargoid=cargo,
            denominacioncargoespecificoid=cargo_esp,
            tiponominaid=tipo_nomina,
            estatusid=estatus,
            Tipo_personal=tipo_pasivo,
            Dependencia=dependencia,
            DireccionGeneral=direccion,
            observaciones='Alta directa de personal pasivo.',
        )

        if usuario_id is not None:
            nombre_nomina = tipo_nomina.nomina.upper()
            motivo = None
            if 'JUBIL' in nombre_nomina:
                motivo = obtener_motivo_de_sistema(MOTIVO_SISTEMA_JUBILACION)
            elif 'PENSION' in nombre_nomina:
                motivo = obtener_motivo_de_sistema(MOTIVO_SISTEMA_PENSION_INVALIDEZ)
            events.cargo_movimiento_ejecutado.send(
                sender=RepoPasivosORM,
                cargo_id=asignacion.pk,
                cedula=cedula,
                tipo_movimiento='INGRESO',
                motivo_id=motivo.pk if motivo else None,
                usuario_id=usuario_id,
                origen=events.ORIGEN_PASIVOS,
            )
        return pasivo_desde_asignacion(asignacion)

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

        motivo = obtener_motivo_de_operacion(
            motivo_movimiento_id, Operacion.PASE_A_PASIVO, campo='motivo_movimiento_id',
        )

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

        # Fase 8 de paridad funcional: snapshot histórico de los cargos al
        # pasivar (`CargoEgresado`). Referencia al `EmployeeEgresado` creado
        # aquí y guarda los detalles del cargo que se libera. Si ya existe un
        # `EmployeeEgresado` para esta cédula (egreso previo con liberar_activos),
        # se reutiliza; si no, se crea.
        egreso = (
            EmployeeEgresadoModel.objects.filter(employee=empleado).order_by('-fecha_egreso').first()
        )
        if not egreso:
            egreso = EmployeeEgresadoModel.objects.create(
                employee=empleado,
                n_contrato=ultima_asig.codigo,
                fechaingresoorganismo=timezone.now().date(),
                motivo_egreso=motivo,
            )
        CargoEgresadoModel.objects.create(
            egreso=egreso,
            codigo=ultima_asig.codigo,
            denominacioncargoid=ultima_asig.denominacioncargoid,
            denominacioncargoespecificoid=ultima_asig.denominacioncargoespecificoid,
            gradoId=ultima_asig.gradoid,
            tipoNominaId=tipo_nomina,
            tipoPersonalId=tipo_pasivo,
            dependenciaId=ultima_asig.Dependencia,
            direccionGeneralId=ultima_asig.DireccionGeneral,
            direccionLineaId=ultima_asig.DireccionLinea,
            coordinacionId=ultima_asig.Coordinacion,
            organismoAdscritoId=ultima_asig.OrganismoAdscritoid,
        )

        # Fase 2.5 del plan de reparación: cierra el gap que quedó
        # documentado hasta ahora, reutilizando el mismo evento que emite
        # `RepoCargosORM.asignar_cargo_a_empleado` — `apps.movimientos` no
        # distingue de qué módulo vino el cambio de cargo.
        if usuario_id is not None:
            events.cargo_movimiento_ejecutado.send(
                sender=RepoPasivosORM,
                cargo_id=nueva_asig.pk,
                cedula=cedula,
                tipo_movimiento='EGRESO',
                motivo_id=motivo_movimiento_id,
                usuario_id=usuario_id,
                origen=events.ORIGEN_PASIVOS,
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
        return generar_codigo_pasivo(tipo_nomina)
