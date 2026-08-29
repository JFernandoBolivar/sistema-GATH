"""
Mapper de Movimientos.
"""
from apps.movimientos.domain.entities.movimiento import MovimientoCargo
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel


def movimiento_a_entidad(modelo: EmployeeMovementHistoryModel) -> MovimientoCargo:
    empleado_ejecutor = getattr(modelo.ejecutado_por, 'cedula', None)
    ejecutado_por_nombre = (
        f"{empleado_ejecutor.nombres} {empleado_ejecutor.apellidos}".strip()
        if empleado_ejecutor else 'Analista no encontrado'
    )
    return MovimientoCargo(
        id=modelo.pk,
        empleado_cedula=modelo.empleado.cedulaidentidad,
        codigo_puesto=modelo.codigo_puesto,
        tipo_movimiento=modelo.tipo_movimiento,
        motivo_id=modelo.motivo_id,
        motivo_nombre=modelo.motivo.movimiento if modelo.motivo_id else None,
        denominacion_nombre=modelo.denominacioncargo.cargo,
        especifica_nombre=modelo.denominacioncargoespecifico.cargo,
        grado_nombre=modelo.gradoid.grado if modelo.gradoid_id else None,
        tipo_nomina_nombre=modelo.tiponomina.nomina,
        estatus_nombre=modelo.estatus.estatus,
        tipo_personal_nombre=modelo.tipo_personal.tipo_personal if modelo.tipo_personal_id else None,
        dependencia_nombre=modelo.DependenciasId.dependencia if modelo.DependenciasId_id else None,
        direccion_general_nombre=(
            modelo.DireccionGeneralid.direccion_general if modelo.DireccionGeneralid_id else None
        ),
        direccion_linea_nombre=(
            modelo.DireccionLineaid.direccion_linea if modelo.DireccionLineaid_id else None
        ),
        coordinacion_nombre=modelo.Coordinacionid.coordinacion if modelo.Coordinacionid_id else None,
        fecha_movimiento=modelo.fecha_movimiento.isoformat(),
        ejecutado_por_id=modelo.ejecutado_por_id,
        ejecutado_por_nombre=ejecutado_por_nombre,
    )
