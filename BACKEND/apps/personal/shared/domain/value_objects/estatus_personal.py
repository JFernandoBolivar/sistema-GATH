"""
Value Objects de estatus y tipo de personal (R-04, B5, B1).

Vivían como strings sueltos en `RAC/utils/constants.py`, comparados
literalmente contra columnas de catálogo en BD (tablas `Estatus` y
`Tipo_personal` del legado `RAC`). Se comparten entre el flujo de personal
activo y el de pasivo (ambos filtran por `Tipo_personal__tipo_personal` y por
`estatus`), por eso viven en `apps/personal/shared/domain/` (el paquete de
dominio compartido entre `personal`/`pasivos`, B4.3/B4.4) y no en
`apps/personal/domain/` ni en `apps/pasivos/domain/` exclusivamente.

Módulo puro (sin Django, sin DRF, sin ORM — regla B1). Se modelan como
`(str, Enum)` para conservar la comparabilidad textual con el legado: un
`EstatusAsignacion.ACTIVO == "ACTIVO"` es `True` porque hereda de `str`. El
re-export de compatibilidad en `RAC/utils/constants.py` usa `.value`
explícitamente para no cambiar el tipo (`str` plano) que ve el código legado.
"""
from enum import Enum


class EstatusAsignacion(str, Enum):
    """Estatus del contrato/asignación laboral (tabla `Estatus` legada)."""

    ACTIVO = "ACTIVO"
    VACANTE = "VACANTE"
    VENCIDO = "VENCIDO"
    POR_VENCER = "POR VENCER"


class TipoPersonal(str, Enum):
    """Tipo de personal: activo vs. pasivo (tabla `Tipo_personal` legada)."""

    ACTIVO = "ACTIVO"
    PASIVO = "PASIVO"


# Listas de estatus permitidos para transiciones de negocio (egreso,
# reincorporación). Se preservan tal cual, solo referenciando ahora los VOs
# de arriba en lugar de strings duplicados.
ESTATUS_PERMITIDOS: list[str] = [
    "SUSPENDIDO",
    "BLOQUEADO",
    EstatusAsignacion.ACTIVO.value,
]

ESTATUS_PERMITIDOS_EGRESOS: list[str] = [
    TipoPersonal.PASIVO.value,
    "EGRESADO",
]
