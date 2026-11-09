"""Los gráficos de respaldo del PDF de estadísticas deben leerse impresos (>= 8 pt)."""
from types import SimpleNamespace

from reportlab.lib.units import mm

from apps.fe_de_vida.infrastructure.pdf import estadisticas_pdf as pdf

MINIMO_PT = 8


def _estadisticas():
    conteos = SimpleNamespace(
        total=10, respondieron=6, faltan=4,
        por_tipo=[SimpleNamespace(tipo_nomina='JUBILADOS', respondieron=6, faltan=4, total=10)],
        por_estado=[SimpleNamespace(estado='VALIDADA', total=6)],
    )
    return SimpleNamespace(conteos=conteos)


def _tamanos(dibujo):
    return [e.fontSize for e in dibujo.contents if hasattr(e, 'fontSize')]


def test_constantes_de_tamano_son_legibles():
    assert pdf.TAM_EJES >= MINIMO_PT and pdf.TAM_VALORES >= MINIMO_PT and pdf.TAM_LEYENDA >= MINIMO_PT


def test_graficos_de_barras_de_respaldo_usan_fuentes_legibles_y_muestran_valores():
    for dibujo in (pdf._grafico_tipos(_estadisticas(), 170 * mm), pdf._grafico_estados(_estadisticas(), 170 * mm)):
        grafico = next(e for e in dibujo.contents if hasattr(e, 'categoryAxis'))
        assert grafico.categoryAxis.labels.fontSize >= MINIMO_PT
        assert grafico.valueAxis.labels.fontSize >= MINIMO_PT
        assert grafico.barLabelFormat == '%d'
        assert grafico.barLabels.fontSize >= MINIMO_PT


def test_leyendas_de_respaldo_legibles():
    for dibujo in (pdf._grafico_tipos(_estadisticas(), 170 * mm), pdf._grafico_cobertura(_estadisticas(), 80 * mm)):
        assert all(t >= MINIMO_PT for t in _tamanos(dibujo))
