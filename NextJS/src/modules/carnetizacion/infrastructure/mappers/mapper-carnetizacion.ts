/**
 * Mappers para convertir datos de Carnetización a entidades de dominio.
 */
import type { Carnet, PlantillaCarnet } from "../../domain/entities/carnet";
import type { CarnetApiItem, PlantillaCarnetApiItem } from "../http/carnetizacion-api";

export function carnetApiAEntidad(raw: CarnetApiItem): Carnet {
  return {
    id: raw.id,
    empleadoCedula: raw.empleado_cedula,
    empleadoNombres: raw.empleado_nombres,
    empleadoApellidos: raw.empleado_apellidos,
    securityHash: raw.security_hash,
    fechaEmision: raw.fecha_emision,
    motivoId: raw.motivo_id,
    motivoNombre: raw.motivo_nombre,
    activo: raw.activo,
    observaciones: raw.observaciones,
  };
}

export function plantillaCarnetApiAEntidad(raw: PlantillaCarnetApiItem): PlantillaCarnet {
  return {
    id: raw.id,
    nombre: raw.nombre,
    imagenUrl: raw.imagen_url,
    activo: raw.activo,
    creado: raw.creado,
  };
}
