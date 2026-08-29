"""
Tests unitarios de las reubicaciones R-02 (CleanZerosMixin), R-03
(extract_first_error) y R-06 (ReportFieldRegistry). Puros, sin BD.
"""
from core.infrastructure.serializer_mixins import CleanZerosMixin
from core.infrastructure.error_utils import extract_first_error
from core.infrastructure.report_field_registry import (
    MAPA_REPORTES,
    ReportFieldRegistryORM,
    get_available_report_categories,
    get_config_by_category,
)


class _FakeSuper:
    def to_internal_value(self, data):
        return data


class _Cleaner(CleanZerosMixin, _FakeSuper):
    pass


def test_clean_zeros_mixin_normaliza_valores_vacios():
    limpio = _Cleaner().to_internal_value({
        "a": 0, "b": "0", "c": "None", "d": None,
        "e": "undefined", "f": "null", "g": "", "h": "ok",
        "i": {"x": 0, "y": "ok"}, "j": [1, 0, 2],
    })
    assert limpio["a"] is None
    assert limpio["b"] is None
    assert limpio["h"] == "ok"
    assert limpio["i"] == {"x": None, "y": "ok"}
    assert limpio["j"] == [1, 2]


def test_extract_first_error_desempaqueta_anidado():
    errores = {"campo": ["primer error", "segundo error"]}
    assert extract_first_error(errores) == "primer error"


def test_compatibilidad_hacia_atras_rac_data_formatters():
    from RAC.utils import data_formatters

    assert data_formatters.CleanZerosMixin is CleanZerosMixin
    assert data_formatters.extract_first_error is extract_first_error


def test_report_field_registry_consolida_rac_y_autogestion_sin_colision():
    assert set(MAPA_REPORTES) == {
        "empleados", "familiares", "egresados", "asignaciones", "censo_vivienda",
    }
    registro = ReportFieldRegistryORM()
    assert registro.configuracion("censo_vivienda")["modelo"] == "Employee"
    assert registro.configuracion("empleados")["modelo"] == "Employee"
    assert registro.categorias_disponibles() == get_available_report_categories()
    assert registro.tipos_reporte() == {"conteo", "lista"}


def test_compatibilidad_hacia_atras_mapa_reporte_rac_y_autogestion():
    from RAC.utils import mapa_reporte as rac_mapa
    from AUTOGESTION.utils import mapa_reporte as autogestion_mapa

    assert rac_mapa.MAPA_REPORTES is MAPA_REPORTES
    assert autogestion_mapa.MAPA_REPORTES is MAPA_REPORTES
    assert get_config_by_category("empleados")["agrupaciones"]
