"""
Anotación ORM de la antigüedad APN oficial (G9, decisión D-05).

La fuente autoritativa es el método comercial 30/360 de
`apps.personal.shared.domain.services.tiempo_servicio.calcular_total_apn`
(Python), que suma SOLO antecedentes con `fecha_ingreso` y `fecha_egreso` y usa:

    dias = (año_egreso - año_ingreso) * 360
         + (mes_egreso - mes_ingreso) * 30
         + (día_egreso - día_ingreso) + 1

No se aplica *clamp* del día 31: la función oficial no lo hace, y añadirlo
rompería la paridad. El `+1` es el día de inicio que incluye el método.

La fracción de año debe ser idéntica a
`tiempo_servicio.anios_fraccionarios`: años + meses/12 + días/365.

Esta consulta NO toca `Employee.total_anos_apn` (columna legada mantenida por
`trg_actualizar_apn`, días/365.25 e incluye antecedentes abiertos).
"""
from django.db.models import (
    ExpressionWrapper,
    F,
    FloatField,
    IntegerField,
    OuterRef,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import (
    Coalesce,
    ExtractDay,
    ExtractMonth,
    ExtractYear,
    Floor,
)

from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
)

# Días comerciales de un antecedente cerrado, con la fórmula oficial.
_DIAS_COMERCIALES = (
    (ExtractYear('fecha_egreso') - ExtractYear('fecha_ingreso')) * Value(360)
    + (ExtractMonth('fecha_egreso') - ExtractMonth('fecha_ingreso')) * Value(30)
    + (ExtractDay('fecha_egreso') - ExtractDay('fecha_ingreso'))
    + Value(1)
)

_TOTAL_DIAS = Coalesce(
    Subquery(
        AntecedenteServicioModel.objects
        .filter(
            empleado=OuterRef('pk'),
            fecha_ingreso__isnull=False,
            fecha_egreso__isnull=False,
        )
        .values('empleado')
        .annotate(total=Sum(_DIAS_COMERCIALES))
        .values('total')[:1],
        output_field=IntegerField(),
    ),
    Value(0),
)

_ANIOS = Floor(F('_apn_dias') / 360.0)
_RESTO = ExpressionWrapper(
    F('_apn_dias') - _ANIOS * 360.0, output_field=FloatField()
)
_MESES = Floor(_RESTO / 30.0)
_DIAS_RESTO = ExpressionWrapper(
    _RESTO - _MESES * 30.0, output_field=FloatField()
)
_ANIOS_FRACCION = ExpressionWrapper(
    _ANIOS + _MESES / 12.0 + _DIAS_RESTO / 365.0,
    output_field=FloatField(),
)


def anotar_apn_oficial(queryset):
    """Anota `apn_oficial` (años fraccionarios) sin leer la columna legada."""
    return queryset.annotate(_apn_dias=_TOTAL_DIAS).annotate(
        apn_oficial=_ANIOS_FRACCION
    )
