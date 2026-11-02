"""
Filtro de la `cuenta` legada (R-01, B3).

Vivía en `RAC/filters/filters_personal.py` filtrando el modelo `cuenta` de
`USER`, a pesar de no tener relación de dominio con `RAC`: `cuenta` es
propiedad de `identidad` (usuarios/roles), no de personal. Se traslada tal
cual, sin tocar una sola línea de comportamiento.

TODO (riesgo documentado, ver reporte de la tarea R-01): este filtro importa
el modelo `cuenta` legado directamente desde `USER.models.user_models`, lo
que viola el contrato `identidad-independiente` de `.importlinter` (B16:
`apps.identidad` no debería importar de las apps legadas). Se decidió
preservar el import legado en lugar de apuntar al modelo espejo
`apps.identidad.infrastructure.models.cuenta_models.CuentaModel` porque este
filtro depende de la relación inversa `cedula__assignments__*` (hacia
`AsigTrabajo`), que hoy solo existe en el grafo de modelos legado
(`RAC.Employee.assignments`); ni `apps.personal.EmployeeModel` ni
`apps.cargos` exponen todavía esa relación como espejo. Cambiar el modelo
aquí sin esa relación rompería los filtros `codigo`, `dependencia_id`,
`direccion_general_id`, `direccion_linea_id` y `coordinacion_id` en
producción. Corregir cuando `apps.cargos`/`apps.personal` completen el
espejo de asignaciones (Fase B4.5).
"""
import django_filters
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel


class CuentaFilter(django_filters.FilterSet):
    cedulaidentidad = django_filters.CharFilter(
        field_name='cedula__cedulaidentidad',
        lookup_expr='exact'
    )
    codigo = django_filters.CharFilter(
        field_name='cedula__assignments__codigo',
        lookup_expr='exact'
    )
    dependencia_id = django_filters.NumberFilter(
        field_name='cedula__assignments__Dependencia'
    )
    direccion_general_id = django_filters.NumberFilter(
        field_name='cedula__assignments__DireccionGeneral'
    )
    direccion_linea_id = django_filters.NumberFilter(
        field_name='cedula__assignments__DireccionLinea'
    )
    coordinacion_id = django_filters.NumberFilter(
        field_name='cedula__assignments__Coordinacion'
    )

    class Meta:
        model = CuentaModel
        fields = []

