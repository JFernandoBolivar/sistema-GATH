"""
Repositorio ORM de Reportes (Reglas B4, B7).
"""
from apps.reportes.domain.entities.resultado_reporte import ResultadoReporte


class RepoReportesORM:
    def reporte_personal_activo(self, filtros: dict) -> ResultadoReporte:
        from apps.personal.infrastructure.models.personal_models import EmployeeModel
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        qs = EmployeeModel.objects.select_related('sexoid', 'estadoCivil', 'nacionalidad').all()
        filtros = filtros or {}
        if filtros.get('sexo_id'):
            qs = qs.filter(sexoid_id=filtros['sexo_id'])
        if filtros.get('estado_civil_id'):
            qs = qs.filter(estadoCivil_id=filtros['estado_civil_id'])

        asig_filtros = {}
        if filtros.get('dependencia_id'):
            asig_filtros['Dependencia_id'] = filtros['dependencia_id']
        if filtros.get('direccion_general_id'):
            asig_filtros['DireccionGeneral_id'] = filtros['direccion_general_id']
        if filtros.get('direccion_linea_id'):
            asig_filtros['DireccionLinea_id'] = filtros['direccion_linea_id']
        if filtros.get('coordinacion_id'):
            asig_filtros['Coordinacion_id'] = filtros['coordinacion_id']
        if filtros.get('nomina_id'):
            asig_filtros['tiponominaid_id'] = filtros['nomina_id']
        if filtros.get('grado_id'):
            asig_filtros['gradoid_id'] = filtros['grado_id']
        if filtros.get('cargo_id'):
            asig_filtros['denominacioncargoid_id'] = filtros['cargo_id']
        if filtros.get('cargo_especifico_id'):
            asig_filtros['denominacioncargoespecificoid_id'] = filtros['cargo_especifico_id']
        if filtros.get('OrganismoAdscrito_id'):
            asig_filtros['OrganismoAdscritoid_id'] = filtros['OrganismoAdscrito_id']

        from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel

        if asig_filtros:
            cedulas = AsigTrabajoModel.objects.filter(**asig_filtros).exclude(employee__isnull=True).values_list('employee_id', flat=True)
            qs = qs.filter(cedulaidentidad__in=cedulas)

        empleados_list = list(qs[:500])
        asigs = {
            a.employee_id: a
            for a in AsigTrabajoModel.objects.filter(employee__in=empleados_list)
            .select_related('denominacioncargoid', 'tiponominaid', 'OrganismoAdscritoid')
        }
        antecedentes = {
            ant.empleado_id: ant.fecha_ingreso
            for ant in AntecedenteServicioModel.objects.filter(empleado__in=empleados_list).order_by('fecha_ingreso')
        }

        filas = []
        for idx, e in enumerate(empleados_list, start=1):
            asig = asigs.get(e.cedulaidentidad)
            f_ing = antecedentes.get(e.cedulaidentidad)
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
                'organismo_adscrito': asig.OrganismoAdscritoid.nombre if asig and asig.OrganismoAdscritoid else 'CONATEL',
            })

        return ResultadoReporte(
            titulo="Reporte de Personal Activo",
            columnas=['#', 'codigo', 'cedula', 'nombres', 'apellidos', 'fecha_ingreso', 'sexo', 'tipo_nomina', 'cargo', 'organismo_adscrito'],
            filas=filas,
            total_registros=len(filas),
        )

    def reporte_egresos_pasivos(self, filtros: dict) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
        from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel
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
        for idx, p in enumerate(qs[:500], start=1):
            emp = p.employee
            ant = AntecedenteServicioModel.objects.filter(empleado=emp).order_by('fecha_ingreso').first() if emp else None
            f_ing = ant.fecha_ingreso.strftime('%d/%m/%Y') if ant and ant.fecha_ingreso else 'N/A'
            f_egr = p.fecha_egreso.strftime('%d/%m/%Y') if p.fecha_egreso else 'N/A'

            ultimo_cargo = ''
            historial = p.cargos_historial.select_related('denominacioncargoid').first()
            if historial and historial.denominacioncargoid:
                ultimo_cargo = historial.denominacioncargoid.cargo
            elif emp:
                asig = AsigTrabajoModel.objects.filter(employee=emp).select_related('denominacioncargoid').first()
                if asig and asig.denominacioncargoid:
                    ultimo_cargo = asig.denominacioncargoid.cargo

            filas.append({
                '#': str(idx),
                'cedula': str(p.employee_id),
                'nombre_completo': f"{emp.nombres} {emp.apellidos}".strip() if emp else '',
                'fecha_ingreso': f_ing,
                'fecha_egreso': f_egr,
                'motivo_egreso': str(p.motivo_egreso.motivo) if p.motivo_egreso else '',
                'ultimo_cargo': ultimo_cargo or 'N/A',
            })

        return ResultadoReporte(
            titulo="Reporte de Egresados",
            columnas=['#', 'cedula', 'nombre_completo', 'fecha_ingreso', 'fecha_egreso', 'motivo_egreso', 'ultimo_cargo'],
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
        for idx, c in enumerate(qs[:500], start=1):
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
        for idx, f in enumerate(qs[:500], start=1):
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
        )

    def reporte_codigos(self, filtros: dict) -> ResultadoReporte:
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

        filas = []
        for idx, c in enumerate(qs[:500], start=1):
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
                'organismo_adscrito': c.OrganismoAdscritoid.nombre if c.OrganismoAdscritoid_id else 'CONATEL',
                'estatus': c.estatusid.estatus if c.estatusid_id else '',
            })

        return ResultadoReporte(
            titulo="Reporte de Cargos",
            columnas=['#', 'codigo', 'cedula', 'empleado', 'cargo', 'cargo_especifico', 'grado', 'tipo_nomina', 'organismo_adscrito', 'estatus'],
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
