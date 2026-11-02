/**
 * Mappers para convertir datos de la API a entidades de dominio.
 */
import type {
  Coordinacion,
  Dependencia,
  DireccionGeneral,
  DireccionLinea,
  OrganismoAdscrito,
} from "../../domain/entities/organizacion";
import type {
  CoordinacionApiItem,
  DependenciaApiItem,
  DireccionGeneralApiItem,
  DireccionLineaApiItem,
  OrganismoAdscritoApiItem,
} from "../http/organizacion-api";

export function dependenciaApiAEntidad(raw: DependenciaApiItem): Dependencia {
  return { id: raw.id, codigo: raw.codigo, nombre: raw.nombre };
}

export function direccionGeneralApiAEntidad(raw: DireccionGeneralApiItem): DireccionGeneral {
  return { id: raw.id, codigo: raw.codigo, nombre: raw.nombre, dependenciaId: raw.dependencia_id };
}

export function direccionLineaApiAEntidad(raw: DireccionLineaApiItem): DireccionLinea {
  return { id: raw.id, codigo: raw.codigo, nombre: raw.nombre, direccionGeneralId: raw.direccion_general_id };
}

export function coordinacionApiAEntidad(raw: CoordinacionApiItem): Coordinacion {
  return { id: raw.id, codigo: raw.codigo, nombre: raw.nombre, direccionLineaId: raw.direccion_linea_id };
}

export function organismoAdscritoApiAEntidad(raw: OrganismoAdscritoApiItem): OrganismoAdscrito {
  return { id: raw.id, nombre: raw.nombre, parentId: raw.parent_id };
}
