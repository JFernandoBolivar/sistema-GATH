"""
Repositorio ORM de Pasivos (Reglas B4, B7, D-09).
"""
from django.db import transaction
from django.db.models import Min, Q
from django.utils import timezone

from core.domain.catalogos import (
    ESTATUS_ACTIVO,
    ESTATUS_EGRESADO,
    ESTATUS_PASIVO,
    ESTATUS_VACANTE,
    TIPO_PERSONAL_PASIVO,
)
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
                Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
                estatusid__estatus__iexact=ESTATUS_EGRESADO,
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
            .filter(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO, employee__isnull=False)
            .exclude(estatusid__estatus__iexact=ESTATUS_EGRESADO)
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
        motivo_id: int | None = None,
        fecha_desde=None,
        fecha_hasta=None,
        sin_cuenta: bool | None = None,
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
        # del trabajador, motivo_id, mapeo diferido). La fecha de egreso filtra;
        # el orden es por última actualización (lo más reciente primero, QA 2026-11-03).
        por_cedula: dict[str, tuple[str, str, int | None, object]] = {}
        cesados = self._cedulas_pasivas_egresadas()
        cuentas_cedulas: set[str] | None = None
        if sin_cuenta is not None:
            from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
            cuentas_cedulas = set(CuentaModel.objects.values_list('cedula_id', flat=True))

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
            emp_id = str(fila.employee_id)
            if emp_id in cesados:
                continue
            if cuentas_cedulas is not None:
                if sin_cuenta and emp_id in cuentas_cedulas:
                    continue
                if not sin_cuenta and emp_id not in cuentas_cedulas:
                    continue
            fecha_vig = str(fila.fecha_egreso)[:10] if fila.fecha_egreso else ''
            por_cedula[emp_id] = (
                fecha_vig,
                _actualizado(fila.employee),
                fila.motivo_egreso_id,
                lambda fila=fila: pasivo_a_entidad(fila),
            )

        qs_asignaciones = (
            AsigTrabajoModel.objects.select_related('employee', 'employee__sexoid', 'tiponominaid')
            .filter(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO, employee__isnull=False)
            .exclude(estatusid__estatus__iexact=ESTATUS_EGRESADO)
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

        cedulas_asig = list(qs_asignaciones.values_list('employee_id', flat=True))
        egresos_dict = {
            str(e.employee_id): (str(e.fecha_egreso)[:10] if e.fecha_egreso else '', e.motivo_egreso_id)
            for e in EmployeeEgresadoModel.objects.filter(employee_id__in=cedulas_asig).order_by('-fecha_egreso')
        }

        for asig in qs_asignaciones:
            asig_emp_id = str(asig.employee_id)
            if cuentas_cedulas is not None:
                if sin_cuenta and asig_emp_id in cuentas_cedulas:
                    continue
                if not sin_cuenta and asig_emp_id not in cuentas_cedulas:
                    continue
            egr_info = egresos_dict.get(asig_emp_id)
            fecha_vig = egr_info[0] if egr_info else (str(asig.fecha_actualizacion)[:10] if asig.fecha_actualizacion else '')
            m_id = egr_info[1] if egr_info else None
            por_cedula[asig_emp_id] = (
                fecha_vig,
                _actualizado(asig.employee),
                m_id,
                lambda asig=asig: pasivo_desde_asignacion(asig),
            )

        candidatos = list(por_cedula.values())
        if motivo_id:
            candidatos = [c for c in candidatos if c[2] == motivo_id]
        if fecha_desde:
            candidatos = [c for c in candidatos if (c[0] or '')[:10] >= str(fecha_desde)]
        if fecha_hasta:
            candidatos = [c for c in candidatos if (c[0] or '')[:10] <= str(fecha_hasta)]
        candidatos.sort(key=lambda c: (c[1], c[0] or ''), reverse=True)
        total = len(candidatos)
        pagina = candidatos[desplazamiento:desplazamiento + limite]
        return [mapear() for _, _, _, mapear in pagina], total

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
        if expediente is not None:
            from apps.autogestion.infrastructure.repositories.repo_secciones_complementarios_orm import (
                RepoDatosComplementariosORM,
            )

            # El correo alternativo y «¿tiene hijos?» viven en los datos
            # complementarios de autogestión (una sola lectura): no se
            # duplican ni se guardan en `Employee`.
            complementarios = RepoDatosComplementariosORM().obtener(str(cedula).strip())
            expediente['correo_alternativo'] = complementarios.correo_alternativo if complementarios else None
            expediente['tiene_hijos'] = complementarios.tiene_hijos if complementarios else None

        asignacion = (
            AsigTrabajoModel.objects.select_related('employee', 'employee__sexoid', 'tiponominaid')
            .filter(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO, employee_id=cedula)
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
        fecha_egreso=None,
    ) -> Pasivo:
        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not empleado:
            raise NotFoundError(f'Empleado con cédula {cedula} no encontrado.')
        asignacion = (
            AsigTrabajoModel.objects.filter(
                employee=empleado, Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
            )
            .order_by('-fecha_actualizacion')
            .first()
        )
        if not asignacion:
            raise NotFoundError(f'La cédula {cedula} no tiene una asignación pasiva vigente.')
        motivo = obtener_motivo_de_operacion(motivo_id, Operacion.EGRESO_PASIVO, campo='motivo_id')
        try:
            estatus_egresado = EstatusModel.objects.get(estatus__iexact=ESTATUS_EGRESADO)
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
            egreso = EmployeeEgresadoModel.objects.create(
                employee=empleado,
                n_contrato=asignacion.codigo,
                fechaingresoorganismo=timezone.now().date(),
                motivo_egreso=motivo,
            )
        if fecha_egreso:
            EmployeeEgresadoModel.objects.filter(pk=egreso.pk).update(fecha_egreso=fecha_egreso)

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
        motivo_id: int | None = None,
        fecha_vigencia=None,
        usuario_id: int | None = None,
    ) -> Pasivo:
        """Alta directa de jubilado/pensionado, sin cargo activo previo."""
        from datetime import date
        from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM

        tipo_nomina = TipoNominaModel.objects.filter(
            pk=tipo_nomina_id, es_activo=False,
        ).first()
        if not tipo_nomina:
            raise ValidationError(
                'Seleccione un tipo de nómina de pasivos (es_activo=False).'
            )

        if not motivo_id:
            raise ValidationError('El tipo de jubilación o pensión es obligatorio.', campo='motivo_id')
        if not fecha_vigencia:
            raise ValidationError('La fecha de vigencia es obligatoria.', campo='fecha_vigencia')

        f_vig = fecha_vigencia if isinstance(fecha_vigencia, date) else date.fromisoformat(str(fecha_vigencia)[:10])
        hoy = timezone.now().date()
        if f_vig > hoy:
            raise ValidationError('La fecha de vigencia no puede ser futura.', campo='fecha_vigencia')

        motivo_pase = obtener_motivo_de_operacion(
            motivo_id, Operacion.PASE_A_PASIVO, campo='motivo_id',
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
            estatus = EstatusModel.objects.get(estatus__iexact=ESTATUS_PASIVO)
            tipo_pasivo = TipoPersonalModel.objects.get(
                tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
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
            observaciones=f'Alta directa de personal pasivo. {motivo_pase.movimiento}',
        )

        # FIX-PAS1: Persistir EmployeeEgresadoModel con su fecha de vigencia y motivo
        egreso = EmployeeEgresadoModel.objects.create(
            employee=empleado,
            n_contrato=asignacion.codigo,
            fechaingresoorganismo=f_vig,
            fecha_egreso=f_vig,
            motivo_egreso=motivo_pase,
        )
        if f_vig:
            EmployeeEgresadoModel.objects.filter(pk=egreso.pk).update(fecha_egreso=f_vig)

        CargoEgresadoModel.objects.create(
            egreso=egreso,
            codigo=asignacion.codigo,
            denominacioncargoid=cargo,
            denominacioncargoespecificoid=cargo_esp,
            tipoNominaId=tipo_nomina,
            tipoPersonalId=tipo_pasivo,
            dependenciaId=dependencia,
            direccionGeneralId=direccion,
        )

        if usuario_id is not None:
            events.cargo_movimiento_ejecutado.send(
                sender=RepoPasivosORM,
                cargo_id=asignacion.pk,
                cedula=cedula,
                tipo_movimiento='INGRESO',
                motivo_id=motivo_pase.pk,
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
        fecha_egreso=None,
    ) -> Pasivo:
        # L2-15: bloquear al empleado (y comprobar que no sea ya pasivo) para que
        # dos pases simultáneos no creen dos asignaciones y dos egresos.
        empleado = (
            EmployeeModel.objects.select_for_update()
            .filter(cedulaidentidad=cedula)
            .first()
        )
        if not empleado:
            raise NotFoundError(f"Empleado con cédula {cedula} no encontrado.")
        if AsigTrabajoModel.objects.filter(
            employee=empleado, Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
        ).exists():
            raise ConflictError(f'La cédula {cedula} ya está registrada como pasivo.')

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
            estatus_activo = EstatusModel.objects.get(estatus__iexact=ESTATUS_ACTIVO)
            tipo_pasivo = TipoPersonalModel.objects.get(tipo_personal__iexact=TIPO_PERSONAL_PASIVO)
        except (EstatusModel.DoesNotExist, TipoPersonalModel.DoesNotExist) as exc:
            raise ValidationError(f"Error de configuración de catálogos: {exc}") from exc

        if liberar_activos:
            self._cerrar_expediente_activo(empleado, fecha_egreso)
            try:
                estatus_vacante = EstatusModel.objects.get(estatus__iexact=ESTATUS_VACANTE)
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
            if fecha_egreso:
                # `fecha_egreso` es auto_now_add (fecha de procesamiento): se
                # reemplaza por la fecha REAL indicada en el formulario (O8).
                EmployeeEgresadoModel.objects.filter(pk=egreso.pk).update(
                    fecha_egreso=fecha_egreso,
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

    def _cerrar_expediente_activo(self, empleado: EmployeeModel, fecha_egreso=None) -> None:
        antecedente_activo = AntecedenteServicioModel.objects.filter(
            empleado=empleado, fecha_egreso__isnull=True
        ).first()
        if not antecedente_activo:
            return

        antecedente_activo.fecha_egreso = fecha_egreso or timezone.now().date()
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
