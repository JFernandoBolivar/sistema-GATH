"""
Regresión de la Fase 2.4: cada ruta de `MAPA_REPORTES` debe resolver contra
los modelos ORM actuales. Compila la consulta (sin ejecutarla) para que un
`FieldError` por accesor inverso ausente o campo renombrado falle aquí y no
en producción.
"""
import pytest
from django.apps import apps

from core.infrastructure.report_field_registry import CAMPOS_CALCULADOS, MAPA_REPORTES

MODELOS = {
    "Employee": ("personal", "EmployeeModel"),
    "AsigTrabajo": ("cargos", "AsigTrabajoModel"),
    "EmployeeEgresado": ("pasivos", "EmployeeEgresadoModel"),
}
LOOKUPS_FINALES = ("__gte", "__lte")


def _rutas():
    for categoria, cfg in MAPA_REPORTES.items():
        for seccion in ("campos_permitidos", "filtros_permitidos"):
            for clave, ruta in cfg[seccion].items():
                if ruta in CAMPOS_CALCULADOS:
                    continue
                yield pytest.param(cfg["modelo"], ruta, id=f"{categoria}.{seccion}.{clave}")


@pytest.mark.parametrize("modelo, ruta", list(_rutas()))
def test_ruta_del_registry_resuelve_contra_el_orm(modelo, ruta):
    model = apps.get_model(*MODELOS[modelo])
    for lookup in LOOKUPS_FINALES:
        if ruta.endswith(lookup):
            ruta = ruta[: -len(lookup)]
    # str(query) compila el SQL: lanza FieldError si la ruta no existe.
    str(model.objects.filter(**{f"{ruta}__isnull": True}).query)
