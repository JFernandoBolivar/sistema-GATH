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
