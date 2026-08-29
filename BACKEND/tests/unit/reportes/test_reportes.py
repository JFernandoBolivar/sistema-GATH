"""
Tests unitarios del módulo reportes (Arquitectura Onion pura sin BD).
"""
import pytest

from apps.reportes.application.use_cases.generar_reportes import (
    generar_reporte_pasivos,
    generar_reporte_personal,
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
