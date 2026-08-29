/**
 * Mappers para convertir datos de Movimientos a entidades de dominio.
 */
import type { MovimientoCargo } from "../../domain/entities/movimiento";
import type { MovimientoApiItem } from "../http/movimientos-api";

export function movimientoApiAEntidad(raw: MovimientoApiItem): MovimientoCargo {
  return {
    id: raw.id,
    empleadoCedula: raw.empleado_cedula,
    codigoPuesto: raw.codigo_puesto,
    tipoMovimiento: raw.tipo_movimiento,
    motivoId: raw.motivo_id,
    motivoNombre: raw.motivo_nombre,
    denominacionNombre: raw.denominacion_nombre,
    especificaNombre: raw.especifica_nombre,
    gradoNombre: raw.grado_nombre,
    tipoNominaNombre: raw.tipo_nomina_nombre,
    estatusNombre: raw.estatus_nombre,
    tipoPersonalNombre: raw.tipo_personal_nombre,
    dependenciaNombre: raw.dependencia_nombre,
    direccionGeneralNombre: raw.direccion_general_nombre,
    direccionLineaNombre: raw.direccion_linea_nombre,
    coordinacionNombre: raw.coordinacion_nombre,
    fechaMovimiento: raw.fecha_movimiento,
    ejecutadoPorId: raw.ejecutado_por_id,
    ejecutadoPorNombre: raw.ejecutado_por_nombre,
  };
}
