"""
Test de compatibilidad hacia atrás de R-01: `CuentaFilter` se reubicó a
`apps/identidad/presentation/filters/cuenta_filters.py`, pero
`RAC/filters/filters_personal.py` debe seguir exponiendo la misma clase
(es la que usa `USER/views/user_views.py`).

Nota de entorno: la suite de pytest corre con `DJANGO_SETTINGS_MODULE =
GATH.settings` (ver `pytest.ini`), que **no** registra `RAC`/`USER` en
`INSTALLED_APPS` (esas apps legadas solo están instaladas bajo
`GATH.settings`, el settings de producción — son dos proyectos Django en
paralelo mientras dura el estrangulamiento). Importar `RAC.filters.filters_personal`
aquí falla por eso (`RAC.models.family_personal_models.Parentesco` no declara
`app_label` explícito y no hay app registrada que lo resuelva), sin relación
con el cambio de R-01. Ese import se verificó manualmente con
`DJANGO_SETTINGS_MODULE=GATH.settings` (ver reporte de la tarea): la clase
re-exportada es idéntica (`is`) a la nueva. Aquí solo se prueba la parte que
sí es alcanzable bajo `GATH.settings`: la clase nueva en `apps.identidad`.
"""
from apps.identidad.presentation.filters.cuenta_filters import CuentaFilter as CuentaFilterNuevo


def test_cuenta_filter_declara_los_mismos_campos_de_filtro():
    campos = set(CuentaFilterNuevo.base_filters.keys())
    assert campos == {
        "cedulaidentidad", "codigo", "dependencia_id",
        "direccion_general_id", "direccion_linea_id", "coordinacion_id",
    }
