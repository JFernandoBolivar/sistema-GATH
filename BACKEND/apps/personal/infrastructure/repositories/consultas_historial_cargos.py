"""
Historial de cargos de un trabajador para el expediente en PDF.

Sale de `EmployeeMovementHistory` (módulo `movimientos`), que registra cada
ingreso, traslado, cambio de estatus o egreso con su fecha. Se lee aquí, en
infraestructura (único lugar donde se permite cruzar módulos, B16), y se
entrega como dicts planos con «Desde» y «Hasta»: el «Hasta» de un cargo es la
fecha del movimiento siguiente; el último queda «Presente» salvo que sea un
egreso.
"""
from django.utils import timezone

from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel

_RELACIONES = (
    'denominacioncargo', 'denominacioncargoespecifico', 'gradoid', 'tiponomina',
    'DependenciasId', 'DireccionGeneralid', 'DireccionLineaid', 'Coordinacionid',
)

_ETIQUETAS = {
    'INGRESO': 'Ingreso',
    'TRASLADO': 'Traslado',
    'EGRESO': 'Egreso',
    'CAMBIO DE ESTATUS': 'Cambio de estatus',
}


def _oficina(m) -> str | None:
    """La unidad más específica: coordinación, dirección de línea, dirección general o dependencia."""
    if m.Coordinacionid_id and m.Coordinacionid:
        return m.Coordinacionid.coordinacion
    if m.DireccionLineaid_id and m.DireccionLineaid:
        return m.DireccionLineaid.direccion_linea
    if m.DireccionGeneralid_id and m.DireccionGeneralid:
        return m.DireccionGeneralid.direccion_general
    return m.DependenciasId.dependencia if m.DependenciasId_id and m.DependenciasId else None


def historial_cargos_de(cedula: str) -> list[dict]:
    """Movimientos del trabajador, del más reciente al más antiguo."""
    movimientos = list(
        EmployeeMovementHistoryModel.objects
        .select_related(*_RELACIONES)
        .filter(empleado__cedulaidentidad=cedula)
        .order_by('fecha_movimiento', 'pk')
    )
    filas = []
    for i, m in enumerate(movimientos):
        siguiente = movimientos[i + 1] if i + 1 < len(movimientos) else None
        es_egreso = m.tipo_movimiento == 'EGRESO'
        if siguiente is not None:
            hasta = timezone.localtime(siguiente.fecha_movimiento).date().isoformat()
        else:
            hasta = None
        especifico = m.denominacioncargoespecifico.cargo if m.denominacioncargoespecifico_id else None
        filas.append({
            'desde': timezone.localtime(m.fecha_movimiento).date().isoformat(),
            'hasta': hasta,
            'es_egreso': es_egreso,
            'movimiento': _ETIQUETAS.get(m.tipo_movimiento, (m.tipo_movimiento or '').capitalize()),
            'tipo_movimiento': m.tipo_movimiento,
            'codigo': m.codigo_puesto,
            'cargo': especifico or (m.denominacioncargo.cargo if m.denominacioncargo_id else None),
            'grado': m.gradoid.grado if m.gradoid_id and m.gradoid else None,
            'oficina': _oficina(m),
        })
    filas.reverse()
    return filas
