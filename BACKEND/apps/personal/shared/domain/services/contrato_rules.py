"""
Reglas puras de negocio para la gestión de contratos de personal activo
(R-09, inventario de reubicación §I.2.2).

Módulo puro (sin Django, sin ORM — regla B1): extrae la parte de
`upsert_contrato`/`verificar_estatus_contrato` que NO depende de acceso a
datos, para que sea la ÚNICA fuente de la regla de negocio, compartida por:

  - `RAC/services/profile_services.py::upsert_contrato` (legado, sigue
    operando bajo `SIGEP.settings` sobre los modelos de `RAC`).
  - `apps/personal/application/use_cases/upsert_contrato.py` (nuevo, opera
    bajo `GATH.settings` sobre los modelos espejo de `apps.personal`).

⚠️ Por qué NO es un re-export físico como R-01/R-02/R-04/R-05/R-06: se
intentó y se verificó empíricamente (antes de escribir este módulo) que
`RAC` no está en `INSTALLED_APPS` de `GATH.settings` ni viceversa
(`apps.personal` no está en `INSTALLED_APPS` de `SIGEP.settings`), y que
Django exige que todo modelo ORM pertenezca a una app instalada
(`RuntimeError` al importar un modelo de una app no instalada). Por lo
tanto NINGUNA función que toque los modelos ORM de contratos puede ser
literalmente la misma en ambos lados — es la misma restricción que la
Entrada #033 documentó para `USER/services/token_service.py` frente a
`apps.identidad` (dos `AUTH_USER_MODEL` distintos). Lo que SÍ se puede
unificar — y es lo que hace este módulo — es la decisión de negocio pura
(sin ORM), que es la parte con más riesgo real de divergencia silenciosa.
"""
from datetime import date
from enum import Enum


class ClaveEstatusContrato(str, Enum):
    ACTIVO = 'activo'
    POR_VENCER = 'por_vencer'
    VENCIDO = 'vencido'


def generar_numero_contrato(inicial_politica: str, cedula: str, correlativo: int) -> str:
    """
    Genera el número de contrato con la nomenclatura oficial:
        {inicial_politica}-{cedula}-{correlativo_zfill_2}

    Ejemplos:
        C-30540767-01   (1er contrato, política CONTRATADO)
        C-30540767-02   (2do contrato)
        C-30540767-03   (3er contrato -> FIJO)
    """
    inicial = (inicial_politica or 'C')[0].upper()
    return f"{inicial}-{cedula}-{str(correlativo).zfill(2)}"


def decidir_estatus_contrato(
    es_fijo: bool,
    fecha_culminacion: date | None,
    hoy: date,
) -> ClaveEstatusContrato:
    """
    Determina el estatus que corresponde a un contrato según sus fechas y
    modalidad. Regla idéntica a la legada `verificar_estatus_contrato`:

    - Si es_fijo=True: siempre ACTIVO (el contrato fijo nunca vence hasta
      un egreso formal del empleado).
    - Si es_fijo=False:
        · fecha_culminacion None          -> ACTIVO
        · fecha_culminacion <= hoy        -> VENCIDO (incluye el día mismo)
        · fecha_culminacion en <= 30 días -> POR_VENCER
        · fecha_culminacion en > 30 días  -> ACTIVO
    """
    if es_fijo:
        return ClaveEstatusContrato.ACTIVO

    if not fecha_culminacion:
        return ClaveEstatusContrato.ACTIVO
    if fecha_culminacion <= hoy:
        return ClaveEstatusContrato.VENCIDO
    if (fecha_culminacion - hoy).days <= 30:
        return ClaveEstatusContrato.POR_VENCER
    return ClaveEstatusContrato.ACTIVO


def es_tercer_contrato(cantidad_actual: int, existe_previo: bool) -> bool:
    """El 3er contrato (índice 2, base 0) siempre se marca es_fijo=True."""
    return (not existe_previo) and cantidad_actual == 2
