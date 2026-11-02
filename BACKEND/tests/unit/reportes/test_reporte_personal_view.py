"""
Contrato de la vista del reporte de personal con el caso de uso (G3 / M5 / M7).

Regresiones cubiertas:
- `dict(request.query_params)` entregaba **listas** por clave y la validación
  de tipos del dominio rechazaba los filtros como «no numéricos».
- El tope de filas depende del formato (un PDF nunca va sin tope).
- La vista resuelve el permiso de estructura con el mismo camino que
  `HasPermission` y entrega un booleano; la regla no vive en la vista.
"""
from django.http import QueryDict

from apps.reportes.application.dtos.reportes_dtos import ResultadoReporteDTO
from apps.reportes.presentation.views import reportes_views


class _PeticionFalsa:
    query_params = QueryDict('edad_min=30&sexo_id=2&agrupar_por=direccion_general')
    user = object()


def _dto():
    return ResultadoReporteDTO(titulo='t', columnas=[], filas=[], total_registros=0, metadatos={})


def _capturar(monkeypatch, capturado, *, puede_filtrar_estructura=True):
    def _generar(repo, filtros, registro, puede_filtrar_estructura, limite):
        capturado.update(
            filtros=filtros,
            puede_filtrar_estructura=puede_filtrar_estructura,
            limite=limite,
        )
        return _dto()

    monkeypatch.setattr(reportes_views, 'generar_reporte_personal', _generar)
    monkeypatch.setattr(
        reportes_views,
        'usuario_tiene_permiso',
        lambda user, codigo: puede_filtrar_estructura,
    )


def test_la_vista_entrega_los_parametros_como_escalares(monkeypatch):
    capturado = {}
    _capturar(monkeypatch, capturado)

    reportes_views._generar_reporte_personal(_PeticionFalsa(), para_pdf=False)

    assert capturado['filtros'] == {
        'edad_min': '30',
        'sexo_id': '2',
        'agrupar_por': 'direccion_general',
    }


def test_la_vista_entrega_la_decision_del_permiso_de_estructura(monkeypatch):
    capturado = {}
    _capturar(monkeypatch, capturado, puede_filtrar_estructura=True)
    reportes_views._generar_reporte_personal(_PeticionFalsa(), para_pdf=False)
    assert capturado['puede_filtrar_estructura'] is True

    capturado.clear()
    _capturar(monkeypatch, capturado, puede_filtrar_estructura=False)
    reportes_views._generar_reporte_personal(_PeticionFalsa(), para_pdf=False)
    assert capturado['puede_filtrar_estructura'] is False


def test_el_pdf_usa_el_tope_de_pdf_y_el_json_el_general(monkeypatch, settings):
    settings.REPORTES_MAX_FILAS = 100
    settings.REPORTES_MAX_FILAS_PDF = 25
    capturado = {}
    _capturar(monkeypatch, capturado)

    reportes_views._generar_reporte_personal(_PeticionFalsa(), para_pdf=True)
    assert capturado['limite'] == 25

    reportes_views._generar_reporte_personal(_PeticionFalsa(), para_pdf=False)
    assert capturado['limite'] == 100
