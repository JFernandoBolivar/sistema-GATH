"""
Repositorio ORM de Reportes (Reglas B4, B7).
"""
from apps.reportes.domain.entities.resultado_reporte import ResultadoReporte


class RepoReportesORM:
    def reporte_personal_activo(self, filtros: dict) -> ResultadoReporte:
        from apps.personal.infrastructure.models.personal_models import EmployeeModel
        qs = EmployeeModel.objects.select_related('sexoid', 'estadoCivil').all()
        if 'sexo_id' in filtros:
            qs = qs.filter(sexoid_id=filtros['sexo_id'])

        filas = []
        for e in qs[:500]:
            filas.append({
                'cedula': e.cedulaidentidad,
                'nombres': e.nombres,
                'apellidos': e.apellidos,
                'sexo': e.sexoid.sexo if e.sexoid else '',
                'correo': e.correo or '',
                'telefono': e.telefono_movil or '',
            })

        return ResultadoReporte(
            titulo="Reporte de Personal Activo",
            columnas=['cedula', 'nombres', 'apellidos', 'sexo', 'correo', 'telefono'],
            filas=filas,
            total_registros=len(filas),
        )

    def reporte_egresos_pasivos(self, filtros: dict) -> ResultadoReporte:
        from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
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

        filas = []
        for p in qs[:500]:
            filas.append({
                'cedula': str(p.employee_id),
                'nombres': p.employee.nombres if p.employee else '',
                'apellidos': p.employee.apellidos if p.employee else '',
                'motivo_egreso': str(p.motivo_egreso) if p.motivo_egreso else '',
                'fecha_egreso': str(p.fecha_egreso),
            })

        return ResultadoReporte(
            titulo="Reporte de Personal Pasivo y Egresos",
            columnas=['cedula', 'nombres', 'apellidos', 'motivo_egreso', 'fecha_egreso'],
            filas=filas,
            total_registros=len(filas),
        )

    def reporte_cargos_vacantes(self, dependencias_ids: list[int] | None = None) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        qs = AsigTrabajoModel.objects.filter(employee__isnull=True).select_related(
            'Dependencia', 'DireccionGeneral', 'denominacioncargoid'
        )
        if dependencias_ids:
            qs = qs.filter(Dependencia_id__in=dependencias_ids)

        filas = []
        for c in qs[:500]:
            filas.append({
                'id': c.pk,
                'denominacion': c.denominacioncargoid.cargo if c.denominacioncargoid else '',
                'dependencia': c.Dependencia.dependencia if c.Dependencia else '',
                'codigo_nomina': c.codigo or '',
            })

        return ResultadoReporte(
            titulo="Reporte de Cargos Vacantes",
            columnas=['id', 'denominacion', 'dependencia', 'codigo_nomina'],
            filas=filas,
            total_registros=len(filas),
        )

    def reporte_familiares(self, filtros: dict) -> ResultadoReporte:
        from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
        qs = EmployeefamilyModel.objects.select_related('employeecedula', 'parentesco', 'sexo').all()

        filtros = filtros or {}
        if filtros.get('parentesco_id'):
            qs = qs.filter(parentesco_id=filtros['parentesco_id'])
        if filtros.get('sexo_id'):
            qs = qs.filter(sexo_id=filtros['sexo_id'])
        if filtros.get('cedula_empleado'):
            qs = qs.filter(employeecedula_id=filtros['cedula_empleado'])

        filas = []
        for f in qs[:500]:
            filas.append({
                'cedula_familiar': f.cedulaFamiliar or '',
                'nombres': f"{f.primer_nombre} {f.segundo_nombre or ''}".strip(),
                'apellidos': f"{f.primer_apellido} {f.segundo_apellido or ''}".strip(),
                'parentesco': f.parentesco.descripcion_parentesco if f.parentesco_id else '',
                'sexo': f.sexo.sexo if f.sexo_id else '',
                'fecha_nacimiento': str(f.fechanacimiento),
                'cedula_empleado': f.employeecedula_id or '',
            })

        return ResultadoReporte(
            titulo="Reporte de Familiares",
            columnas=['cedula_familiar', 'nombres', 'apellidos', 'parentesco', 'sexo', 'fecha_nacimiento', 'cedula_empleado'],
            filas=filas,
            total_registros=len(filas),
        )

    def reporte_codigos(self, filtros: dict) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        qs = AsigTrabajoModel.objects.select_related(
            'denominacioncargoid', 'denominacioncargoespecificoid', 'tiponominaid',
            'estatusid', 'Dependencia', 'DireccionGeneral',
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

        filas = []
        for c in qs[:500]:
            filas.append({
                'codigo': c.codigo,
                'cargo': c.denominacioncargoid.cargo if c.denominacioncargoid_id else '',
                'cargo_especifico': c.denominacioncargoespecificoid.cargo if c.denominacioncargoespecificoid_id else '',
                'tipo_nomina': c.tiponominaid.nomina if c.tiponominaid_id else '',
                'dependencia': c.Dependencia.dependencia if c.Dependencia_id else '',
                'direccion_general': c.DireccionGeneral.direccion_general if c.DireccionGeneral_id else '',
                'estatus': c.estatusid.estatus if c.estatusid_id else '',
            })

        return ResultadoReporte(
            titulo="Reporte de Códigos de Cargo (Asignaciones)",
            columnas=['codigo', 'cargo', 'cargo_especifico', 'tipo_nomina', 'dependencia', 'direccion_general', 'estatus'],
            filas=filas,
            total_registros=len(filas),
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
