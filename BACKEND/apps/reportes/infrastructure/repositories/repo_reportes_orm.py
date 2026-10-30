"""
Repositorio ORM de Reportes (Reglas B4, B7).

Todos los reportes aplican las mismas reglas (G11), centralizadas en
`consultas_reporte`: página materializada una sola vez con `limite` y
metadatos de truncado, orden total y determinista (con desempate por PK),
asignación vigente por empleado (ACTIVA o la más reciente) y fecha de ingreso =
reingreso más reciente. Los datos relacionados se traen en lotes (sin N+1).
"""
from core.domain.exceptions import ValidationError

from apps.reportes.domain.entities.consulta_reporte import ConsultaReportePersonal
from apps.reportes.domain.entities.resultado_reporte import ResultadoReporte
from apps.reportes.infrastructure.repositories.consultas_reporte import (
    elegir_asignaciones,
    en_lotes,
    fechas_de_ingreso,
    ingreso_previo_a,
    ingresos_por_empleado,
    pagina_con_metadatos,
)


def _etiqueta_de_grupo(valor) -> str:
    """Etiqueta legible de un grupo (el registro usa rutas de texto; un FK da su id)."""
    if valor is None or str(valor).strip() == '':
        return 'Sin especificar'
    return str(valor)


def _conteo_personal(qs, consulta: ConsultaReportePersonal, metadatos: dict) -> ResultadoReporte:
    """`tipo_reporte='conteo'`: agrupa por el campo elegido y cuenta."""
    from django.core.exceptions import FieldError
    from django.db.models import Count

    try:
        conteos = (
            # `distinct=True`: el queryset base puede traer una fila por
            # asignación/título; el conteo es de empleados, no de filas.
            qs.values(consulta.agrupar_por_ruta)
            .annotate(total=Count('pk', distinct=True))
            .order_by('-total')
        )
        filas = [
            {
                consulta.agrupar_por: _etiqueta_de_grupo(c.get(consulta.agrupar_por_ruta)),
                'total': c['total'],
            }
            for c in conteos
        ]
    except (FieldError, TypeError) as exc:
        raise ValidationError(
            f'No se puede agrupar el reporte por «{consulta.agrupar_por}».'
        ) from exc

    metadatos['truncado'] = False
    return ResultadoReporte(
        titulo=f'Conteo de Personal Activo por {consulta.agrupar_por}',
        columnas=[consulta.agrupar_por, 'total'],
        filas=filas,
        total_registros=len(filas),
        metadatos=metadatos,
    )


def _asignaciones_por_cedula(AsigTrabajoModel, cedulas) -> dict:
    """Asignación vigente por cédula, en lotes (`ACTIVA` o la más reciente)."""
    elegidas = {}
    for lote in en_lotes(list(cedulas)):
        elegidas.update(elegir_asignaciones(
            AsigTrabajoModel.objects
            .filter(employee__in=lote)
            .select_related(
                'denominacioncargoid', 'tiponominaid', 'OrganismoAdscritoid', 'estatusid',
            )
        ))
    return elegidas


class RepoReportesORM:
    def reporte_personal_activo(
        self, consulta: ConsultaReportePersonal, limite: int
    ) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        from apps.personal.infrastructure.models.expediente_models import (
            AntecedenteServicioModel,
        )
        from apps.personal.infrastructure.models.personal_models import EmployeeModel

        qs = EmployeeModel.objects.select_related('sexoid', 'estadoCivil', 'nacionalidad').all()
        if consulta.lookups:
            # `distinct()`: los filtros por estructura/salud/formación navegan
            # relaciones multivaluadas (asignaciones, familiares, títulos).
            qs = qs.filter(**consulta.lookups).distinct()

        if consulta.tipo_reporte == 'conteo':
            metadatos = {
                'total_encontrados': qs.count(),
                'limite': limite,
                'truncado': False,
                'tipo_reporte': consulta.tipo_reporte,
                'agrupar_por': consulta.agrupar_por,
            }
            return _conteo_personal(qs, consulta, metadatos)

        # Orden total: apellidos, nombres y cédula como desempate. Sin él, dos
        # empleados homónimos podrían entrar o salir del tope entre ejecuciones.
        qs = qs.order_by('apellidos', 'nombres', 'cedulaidentidad')
        pagina, metadatos = pagina_con_metadatos(qs, limite)
        metadatos.update({'tipo_reporte': consulta.tipo_reporte, 'agrupar_por': consulta.agrupar_por})

        cedulas = [e.cedulaidentidad for e in pagina]
        pks = [e.pk for e in pagina]
        asigs = _asignaciones_por_cedula(AsigTrabajoModel, cedulas)
        antecedentes = fechas_de_ingreso(AntecedenteServicioModel, pks)

        filas = []
        for idx, e in enumerate(pagina, start=1):
            asig = asigs.get(e.cedulaidentidad)
            f_ing = antecedentes.get(e.pk)
            filas.append({
                '#': str(idx),
                'codigo': asig.codigo if asig else 'S/D',
                'cedula': str(e.cedulaidentidad),
                'nombres': e.nombres or '',
                'apellidos': e.apellidos or '',
                'fecha_ingreso': f_ing.strftime('%d/%m/%Y') if f_ing else 'N/A',
                'sexo': e.sexoid.sexo if e.sexoid else '',
                'tipo_nomina': asig.tiponominaid.nomina if asig and asig.tiponominaid else 'S/D',
                'cargo': asig.denominacioncargoid.cargo if asig and asig.denominacioncargoid else 'S/D',
                'organismo_adscrito': (
                    asig.OrganismoAdscritoid.Organismoadscrito
                    if asig and asig.OrganismoAdscritoid else 'CONATEL'
                ),
            })

        return ResultadoReporte(
            titulo="Reporte de Personal Activo",
            columnas=['#', 'codigo', 'cedula', 'nombres', 'apellidos', 'fecha_ingreso', 'sexo', 'tipo_nomina', 'cargo', 'organismo_adscrito'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
        )

    def reporte_egresos_pasivos(self, filtros: dict, limite: int) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        from apps.pasivos.infrastructure.models.pasivo_models import (
            CargoEgresadoModel,
            EmployeeEgresadoModel,
        )
        from apps.personal.infrastructure.models.expediente_models import (
            AntecedenteServicioModel,
        )

        qs = EmployeeEgresadoModel.objects.select_related('employee', 'motivo_egreso').all()

        filtros = filtros or {}
        if filtros.get('motivo_id'):
            qs = qs.filter(motivo_egreso_id=filtros['motivo_id'])
        if filtros.get('fecha_egreso_Desde'):
            qs = qs.filter(fecha_egreso__date__gte=filtros['fecha_egreso_Desde'])
        if filtros.get('fecha_egreso_Hasta'):
            qs = qs.filter(fecha_egreso__date__lte=filtros['fecha_egreso_Hasta'])
        if filtros.get('sexo_id'):
            qs = qs.filter(employee__sexoid_id=filtros['sexo_id'])
        if filtros.get('cargo_id'):
            qs = qs.filter(cargos_historial__denominacioncargoid_id=filtros['cargo_id'])
        if filtros.get('nomina_id'):
            qs = qs.filter(cargos_historial__tipoNominaId_id=filtros['nomina_id'])
        if filtros.get('dependencia_id'):
            qs = qs.filter(cargos_historial__dependenciaId_id=filtros['dependencia_id'])
        if any(k in filtros for k in ('cargo_id', 'nomina_id', 'dependencia_id')):
            qs = qs.distinct()

        # Orden total: apellidos, nombres, cédula y PK del egreso como desempate.
        qs = qs.order_by('employee__apellidos', 'employee__nombres', 'employee_id', 'pk')
        pagina, metadatos = pagina_con_metadatos(qs, limite)

        cedulas = [p.employee_id for p in pagina]
        pks_empleado = [p.employee.pk for p in pagina if p.employee_id]
        # Cada egreso muestra el ingreso anterior a él (decisión del usuario 2026-10-30).
        ingresos = ingresos_por_empleado(AntecedenteServicioModel, pks_empleado)

        # Snapshot del cargo al egreso: una por egreso, la de PK más reciente.
        cargos_snapshot = {}
        for lote in en_lotes([p.pk for p in pagina]):
            for cargo in (
                CargoEgresadoModel.objects
                .filter(egreso_id__in=lote)
                .select_related('denominacioncargoid')
                .order_by('egreso_id', '-pk')
            ):
                cargos_snapshot.setdefault(cargo.egreso_id, cargo)

        # Sin snapshot, el cargo de la asignación vigente del empleado.
        asigs = _asignaciones_por_cedula(AsigTrabajoModel, cedulas)

        filas = []
        for idx, p in enumerate(pagina, start=1):
            emp = p.employee
            f_ing = ingreso_previo_a(ingresos.get(emp.pk, []), p.fecha_egreso) if emp else None
            f_egr = p.fecha_egreso.strftime('%d/%m/%Y') if p.fecha_egreso else 'N/A'

            ultimo_cargo = ''
            cargo_snapshot = cargos_snapshot.get(p.pk)
            if cargo_snapshot and cargo_snapshot.denominacioncargoid_id:
                ultimo_cargo = cargo_snapshot.denominacioncargoid.cargo
            else:
                asig = asigs.get(p.employee_id)
                if asig and asig.denominacioncargoid_id:
                    ultimo_cargo = asig.denominacioncargoid.cargo

            filas.append({
                '#': str(idx),
                'cedula': str(p.employee_id),
                'nombre_completo': f"{emp.nombres} {emp.apellidos}".strip() if emp else '',
                'fecha_ingreso': f_ing.strftime('%d/%m/%Y') if f_ing else 'N/A',
                'fecha_egreso': f_egr,
                'motivo_egreso': str(p.motivo_egreso.movimiento) if p.motivo_egreso else '',
                'ultimo_cargo': ultimo_cargo or 'N/A',
            })

        return ResultadoReporte(
            titulo="Reporte de Egresados",
            columnas=['#', 'cedula', 'nombre_completo', 'fecha_ingreso', 'fecha_egreso', 'motivo_egreso', 'ultimo_cargo'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
        )

    def reporte_cargos_vacantes(
        self, limite: int, dependencias_ids: list[int] | None = None
    ) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel

        qs = AsigTrabajoModel.objects.filter(employee__isnull=True).select_related(
            'Dependencia', 'DireccionGeneral', 'denominacioncargoid'
        )
        if dependencias_ids:
            qs = qs.filter(Dependencia_id__in=dependencias_ids)

        # Código del cargo y PK como desempate: orden total y estable.
        qs = qs.order_by('codigo', 'pk')
        pagina, metadatos = pagina_con_metadatos(qs, limite)

        filas = []
        for idx, c in enumerate(pagina, start=1):
            filas.append({
                '#': str(idx),
                'id': c.pk,
                'denominacion': c.denominacioncargoid.cargo if c.denominacioncargoid else '',
                'dependencia': c.Dependencia.dependencia if c.Dependencia else '',
                'codigo_nomina': c.codigo or '',
            })

        return ResultadoReporte(
            titulo="Reporte de Cargos Vacantes",
            columnas=['#', 'id', 'denominacion', 'dependencia', 'codigo_nomina'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
        )

    def reporte_familiares(self, filtros: dict, limite: int) -> ResultadoReporte:
        from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel

        qs = EmployeefamilyModel.objects.select_related('employeecedula', 'parentesco', 'sexo').all()

        filtros = filtros or {}
        if filtros.get('parentesco_id'):
            qs = qs.filter(parentesco_id=filtros['parentesco_id'])
        if filtros.get('sexo_id'):
            qs = qs.filter(sexo_id=filtros['sexo_id'])
        if filtros.get('cedula_empleado'):
            qs = qs.filter(employeecedula_id=filtros['cedula_empleado'])

        # Apellidos/nombres del trabajador, luego los del familiar y PK.
        qs = qs.order_by(
            'employeecedula__apellidos', 'employeecedula__nombres', 'employeecedula_id',
            'primer_apellido', 'primer_nombre', 'pk',
        )
        pagina, metadatos = pagina_con_metadatos(qs, limite)

        filas = []
        for idx, f in enumerate(pagina, start=1):
            emp = f.employeecedula
            f_nac = f.fechanacimiento.strftime('%d/%m/%Y') if f.fechanacimiento else 'N/A'
            filas.append({
                '#': str(idx),
                'cedula_empleado': str(f.employeecedula_id) if f.employeecedula_id else '',
                'nombre_empleado': f"{emp.nombres} {emp.apellidos}".strip() if emp else '',
                'cedula_familiar': f.cedulaFamiliar or 'S/C',
                'nombre_familiar': f"{f.primer_nombre} {f.primer_apellido}".strip(),
                'parentesco': f.parentesco.descripcion_parentesco if f.parentesco_id else '',
                'fecha_nacimiento': f_nac,
                'sexo': f.sexo.sexo if f.sexo_id else '',
            })

        return ResultadoReporte(
            titulo="Reporte de Familiares",
            columnas=['#', 'cedula_empleado', 'nombre_empleado', 'cedula_familiar', 'nombre_familiar', 'parentesco', 'fecha_nacimiento', 'sexo'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
        )

    def reporte_codigos(self, filtros: dict, limite: int) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel

        qs = AsigTrabajoModel.objects.select_related(
            'employee', 'denominacioncargoid', 'denominacioncargoespecificoid', 'gradoid',
            'tiponominaid', 'OrganismoAdscritoid', 'estatusid', 'Dependencia', 'DireccionGeneral',
        ).all()

        filtros = filtros or {}
        if filtros.get('cargo_id'):
            qs = qs.filter(denominacioncargoid_id=filtros['cargo_id'])
        if filtros.get('cargo_especifico_id'):
            qs = qs.filter(denominacioncargoespecificoid_id=filtros['cargo_especifico_id'])
        if filtros.get('nomina_id'):
            qs = qs.filter(tiponominaid_id=filtros['nomina_id'])
        if filtros.get('dependencia_id'):
            qs = qs.filter(Dependencia_id=filtros['dependencia_id'])
        if filtros.get('general_id'):
            qs = qs.filter(DireccionGeneral_id=filtros['general_id'])
        if filtros.get('estatus_id'):
            qs = qs.filter(estatusid_id=filtros['estatus_id'])

        # Código del cargo y PK como desempate: orden total y estable.
        qs = qs.order_by('codigo', 'pk')
        pagina, metadatos = pagina_con_metadatos(qs, limite)

        filas = []
        for idx, c in enumerate(pagina, start=1):
            emp = c.employee
            filas.append({
                '#': str(idx),
                'codigo': c.codigo or '',
                'cedula': str(c.employee_id) if c.employee_id else 'VACANTE',
                'empleado': f"{emp.nombres} {emp.apellidos}".strip() if emp else 'VACANTE',
                'cargo': c.denominacioncargoid.cargo if c.denominacioncargoid_id else '',
                'cargo_especifico': c.denominacioncargoespecificoid.cargo if c.denominacioncargoespecificoid_id else '',
                'grado': c.gradoid.grado if c.gradoid_id else '',
                'tipo_nomina': c.tiponominaid.nomina if c.tiponominaid_id else '',
                'organismo_adscrito': c.OrganismoAdscritoid.Organismoadscrito if c.OrganismoAdscritoid_id else 'CONATEL',
                'estatus': c.estatusid.estatus if c.estatusid_id else '',
            })

        return ResultadoReporte(
            titulo="Reporte de Cargos",
            columnas=['#', 'codigo', 'cedula', 'empleado', 'cargo', 'cargo_especifico', 'grado', 'tipo_nomina', 'organismo_adscrito', 'estatus'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
        )

    def reporte_tendencias_personal(self) -> ResultadoReporte:
        from datetime import datetime, time

        from dateutil.relativedelta import relativedelta
        from django.db.models import Count
        from django.db.models.functions import TruncMonth
        from django.utils import timezone

        from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
        from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel

        desde = timezone.localdate().replace(day=1) - relativedelta(months=11)
        desde_dt = timezone.make_aware(datetime.combine(desde, time.min))

        ingresos_por_mes = (
            AntecedenteServicioModel.objects
            .filter(fecha_ingreso__gte=desde)
            .annotate(periodo=TruncMonth('fecha_ingreso'))
            .values('periodo')
            .annotate(total=Count('id'))
        )
        egresos_por_mes = (
            EmployeeEgresadoModel.objects
            .filter(fecha_egreso__gte=desde_dt)
            .annotate(periodo=TruncMonth('fecha_egreso'))
            .values('periodo')
            .annotate(total=Count('id'))
        )

        mapa_ingresos = {i['periodo'].strftime('%Y-%m'): i['total'] for i in ingresos_por_mes if i['periodo']}
        mapa_egresos = {e['periodo'].strftime('%Y-%m'): e['total'] for e in egresos_por_mes if e['periodo']}

        filas = []
        cursor = desde
        for _ in range(12):
            clave = cursor.strftime('%Y-%m')
            filas.append({
                'periodo': clave,
                'ingresos': mapa_ingresos.get(clave, 0),
                'egresos': mapa_egresos.get(clave, 0),
            })
            cursor = cursor + relativedelta(months=1)

        return ResultadoReporte(
            titulo="Tendencia de Movimientos de Personal (últimos 12 meses)",
            columnas=['periodo', 'ingresos', 'egresos'],
            filas=filas,
            total_registros=len(filas),
        )

    def reporte_distribucion_nomina(self) -> ResultadoReporte:
        from django.db.models import Count

        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel

        conteos = (
            AsigTrabajoModel.objects
            .filter(employee__isnull=False)
            .values('tiponominaid__nomina')
            .annotate(total=Count('id'))
            .order_by('-total')
        )

        filas = [
            {
                'tipo_nomina': c['tiponominaid__nomina'] or 'Sin especificar',
                'total': c['total'],
            }
            for c in conteos
        ]

        return ResultadoReporte(
            titulo="Distribución de Personal por Tipo de Nómina",
            columnas=['tipo_nomina', 'total'],
            filas=filas,
            total_registros=len(filas),
        )
