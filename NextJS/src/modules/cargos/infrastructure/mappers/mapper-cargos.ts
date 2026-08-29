/**
 * Mappers para convertir datos de Cargos a entidades de dominio.
 */
import type { CargoAsignacion, DenominacionCargo } from "../../domain/entities/cargo";
import type { CargoApiItem, DenominacionApiItem } from "../http/cargos-api";

export function cargoApiAEntidad(raw: CargoApiItem): CargoAsignacion {
  return {
    id: raw.id,
    codigoNomina: raw.codigo_nomina,
    empleadoCedula: raw.empleado_cedula,
    empleadoNombre: raw.empleado_nombre,
    denominacionCargoId: raw.denominacion_cargo_id,
    denominacionCargoNombre: raw.denominacion_cargo_nombre,
    dependenciaId: raw.dependencia_id,
    dependenciaNombre: raw.dependencia_nombre,
    direccionGeneralId: raw.direccion_general_id,
    direccionGeneralNombre: raw.direccion_general_nombre,
    activo: raw.activo,
    estaVacante: raw.esta_vacante,
  };
}

export function denominacionApiAEntidad(raw: DenominacionApiItem): DenominacionCargo {
  return {
    id: raw.id,
    nombre: raw.nombre,
  };
}
