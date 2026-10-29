"""
Tests unitarios del módulo reportes (Arquitectura Onion pura sin BD).
"""

from apps.reportes.application.use_cases.generar_reportes import (
    generar_reporte_codigos,
    generar_reporte_distribucion_nomina,
    generar_reporte_familiares,
    generar_reporte_pasivos,
    generar_reporte_personal,
    generar_reporte_tendencias,
    generar_reporte_vacantes,
)
from apps.reportes.domain.entities.resultado_reporte import ResultadoReporte


class RepoReportesMemoria:
    def reporte_personal_activo(self, filtros):
        return ResultadoReporte(
            titulo="Reporte Personal Activo",
            columnas=['cedula', 'nombres', 'apellidos'],
            filas=[{'cedula': '12345678', 'nombres': 'Juan', 'apellidos': 'Pérez'}],
            total_registros=1,
        )

    def reporte_egresos_pasivos(self, filtros):
        return ResultadoReporte(
            titulo="Reporte Pasivos",
            columnas=['cedula', 'motivo_egreso'],
            filas=[{'cedula': '5555555', 'motivo_egreso': 'JUBILACION'}],
            total_registros=1,
        )

    def reporte_cargos_vacantes(self, dependencias_ids=None):
        return ResultadoReporte(
            titulo="Reporte Vacantes",
            columnas=['id', 'denominacion'],
            filas=[{'id': 100, 'denominacion': 'ANALISTA I'}],
            total_registros=1,
        )

    def reporte_familiares(self, filtros):
        return ResultadoReporte(
            titulo="Reporte de Familiares",
            columnas=['cedula_familiar', 'nombres', 'parentesco'],
            filas=[{'cedula_familiar': '99999999', 'nombres': 'Ana Pérez', 'parentesco': 'HIJO(A)'}],
            total_registros=1,
        )

    def reporte_codigos(self, filtros):
        return ResultadoReporte(
            titulo="Reporte de Códigos de Cargo (Asignaciones)",
            columnas=['codigo', 'cargo'],
            filas=[{'codigo': 'COD-001', 'cargo': 'ANALISTA I'}],
            total_registros=1,
        )

    def reporte_tendencias_personal(self):
        return ResultadoReporte(
            titulo="Tendencia de Movimientos de Personal (últimos 12 meses)",
            columnas=['periodo', 'ingresos', 'egresos'],
            filas=[{'periodo': '2026-08', 'ingresos': 2, 'egresos': 1}],
            total_registros=1,
        )

    def reporte_distribucion_nomina(self):
        return ResultadoReporte(
            titulo="Distribución de Personal por Tipo de Nómina",
            columnas=['tipo_nomina', 'total'],
            filas=[{'tipo_nomina': 'FIJO', 'total': 42}],
            total_registros=1,
        )


def test_generar_reporte_personal():
    repo = RepoReportesMemoria()
    rep = generar_reporte_personal(repo, filtros={})
    assert rep.total_registros == 1
    assert rep.filas[0]['cedula'] == '12345678'


def test_generar_reporte_pasivos():
    repo = RepoReportesMemoria()
    rep = generar_reporte_pasivos(repo, filtros={})
    assert rep.total_registros == 1
    assert rep.filas[0]['motivo_egreso'] == 'JUBILACION'


def test_generar_reporte_vacantes():
    repo = RepoReportesMemoria()
    rep = generar_reporte_vacantes(repo)
    assert rep.total_registros == 1
    assert rep.filas[0]['denominacion'] == 'ANALISTA I'


def test_generar_reporte_familiares():
    repo = RepoReportesMemoria()
    rep = generar_reporte_familiares(repo, filtros={})
    assert rep.total_registros == 1
    assert rep.filas[0]['parentesco'] == 'HIJO(A)'


def test_generar_reporte_codigos():
    repo = RepoReportesMemoria()
    rep = generar_reporte_codigos(repo, filtros={})
    assert rep.total_registros == 1
    assert rep.filas[0]['codigo'] == 'COD-001'


def test_generar_reporte_tendencias():
    repo = RepoReportesMemoria()
    rep = generar_reporte_tendencias(repo)
    assert rep.total_registros == 1
    assert rep.filas[0]['periodo'] == '2026-08'
    assert rep.filas[0]['ingresos'] == 2
    assert rep.filas[0]['egresos'] == 1


def test_generar_reporte_distribucion_nomina():
    repo = RepoReportesMemoria()
    rep = generar_reporte_distribucion_nomina(repo)
    assert rep.total_registros == 1
    assert rep.filas[0]['tipo_nomina'] == 'FIJO'
    assert rep.filas[0]['total'] == 42
