"""
Contrato de la vista del reporte de personal con el caso de uso (G3).

Regresión: `dict(request.query_params)` entrega **listas** por clave y la
validación de tipos del dominio rechazaba los filtros como «no numéricos».
"""
from django.http import QueryDict

from apps.reportes.application.dtos.reportes_dtos import ResultadoReporteDTO
from apps.reportes.presentation.views import reportes_views


class _PeticionFalsa:
    query_params = QueryDict('edad_min=30&sexo_id=2&agrupar_por=direccion_general')


def test_la_vista_entrega_los_parametros_como_escalares(monkeypatch):
    capturado = {}

    def _generar(repo, filtros, registro):
        capturado.update(filtros)
        return ResultadoReporteDTO(
            titulo='t', columnas=[], filas=[], total_registros=0, metadatos={}
        )

    monkeypatch.setattr(reportes_views, 'generar_reporte_personal', _generar)

    reportes_views._generar_reporte_personal(_PeticionFalsa())

    assert capturado == {
        'edad_min': '30',
        'sexo_id': '2',
        'agrupar_por': 'direccion_general',
    }
