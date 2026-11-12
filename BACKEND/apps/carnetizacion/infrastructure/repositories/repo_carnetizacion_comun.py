"""Helpers y parÃ¡metros compartidos del repositorio de carnetizaciÃ³n."""
import logging
from typing import Any

from core.domain.catalogos import (
    TIPO_PERSONAL_PASIVO,
)
from core.domain.configuracion import (
    CLAVE_CARNETIZACION_VENCIMIENTO_MESES,
    CLAVE_CARNETIZACION_VIGENCIA_EXTERNO_DIAS,
    CLAVE_CARNETIZACION_VIGENCIA_PASIVO_MESES,
    CLAVE_CARNETIZACION_VIGENCIA_TRABAJADOR_MESES,
)
from core.infrastructure.providers import obtener_lector_configuracion
from apps.carnetizacion.domain.services.vigencia_carnet import (
    TIPO_VIGENCIA_EXTERNO,
    TIPO_VIGENCIA_PASIVO,
    TIPO_VIGENCIA_TRABAJADOR,
    VIGENCIA_RESPALDO_MESES,
    calcular_vencimiento,
)

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel



logger = logging.getLogger('gath.carnetizacion')


_CLAVE_VIGENCIA_POR_TIPO = {
    TIPO_VIGENCIA_TRABAJADOR: CLAVE_CARNETIZACION_VIGENCIA_TRABAJADOR_MESES,
    TIPO_VIGENCIA_PASIVO: CLAVE_CARNETIZACION_VIGENCIA_PASIVO_MESES,
    TIPO_VIGENCIA_EXTERNO: CLAVE_CARNETIZACION_VIGENCIA_EXTERNO_DIAS,
}


def _entero_configurado(clave: str, defecto: int) -> int:
    lector = obtener_lector_configuracion()
    if lector is None:
        return defecto
    try:
        return int(lector.obtener_entero(clave))
    except Exception:
        logger.warning("No se pudo leer el parámetro %s; se usa %s.", clave, defecto, exc_info=True)
        return defecto


def vencimiento_segun_parametros(emision: Any, tipo: str) -> Any:
    """Emisión + vigencia vigente del tipo (o el respaldo global si falta o vale 0)."""
    return calcular_vencimiento(
        emision,
        tipo=tipo,
        valor_tipo=_entero_configurado(_CLAVE_VIGENCIA_POR_TIPO[tipo], 0),
        respaldo_meses=_entero_configurado(
            CLAVE_CARNETIZACION_VENCIMIENTO_MESES, VIGENCIA_RESPALDO_MESES
        ),
    )


def _es_pasivo(empleado: Any) -> bool:
    return (
        AsigTrabajoModel.objects.filter(
            employee=empleado,
            Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
        ).exists()
        or EmployeeEgresadoModel.objects.filter(employee=empleado).exists()
    )


def vencimiento_de_carnet(carnet: Any) -> Any:
    """Fecha guardada al emitir; en carnets anteriores (NULL) se calcula con el parámetro vigente."""
    if carnet.fecha_vencimiento:
        return carnet.fecha_vencimiento
    if not carnet.fecha_emision:
        return None
    tipo = TIPO_VIGENCIA_PASIVO if _es_pasivo(carnet.employee) else TIPO_VIGENCIA_TRABAJADOR
    return vencimiento_segun_parametros(carnet.fecha_emision, tipo)


def cargo_y_departamento(asignacion: Any) -> tuple[str, str]:
    """Cargo y oficina tal como los usa el PDF (`datos.cargo`/`datos.departamento`)."""
    cargo = (
        str(asignacion.denominacioncargoid)
        if asignacion and asignacion.denominacioncargoid else ''
    )
    departamento = (
        asignacion.DireccionGeneral.direccion_general
        if asignacion and asignacion.DireccionGeneral else ''
    )
    return cargo, departamento
