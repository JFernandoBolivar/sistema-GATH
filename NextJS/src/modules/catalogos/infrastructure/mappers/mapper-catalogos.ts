/**
 * Mappers para convertir respuestas de catálogos a entidades de dominio.
 */
import type {
  CatalogoItem,
  Estado,
  Municipio,
  Parroquia,
  Region,
} from "../../domain/entities/catalogos";
import type {
  CatalogoApiItem,
  EstadoApiItem,
  MunicipioApiItem,
  ParroquiaApiItem,
} from "../http/catalogos-api";

export function catalogoApiAEntidad(raw: CatalogoApiItem): CatalogoItem {
  return { id: raw.id, nombre: raw.nombre };
}

export function regionApiAEntidad(raw: CatalogoApiItem): Region {
  return { id: raw.id, nombre: raw.nombre };
}

export function estadoApiAEntidad(raw: EstadoApiItem): Estado {
  return { id: raw.id, nombre: raw.nombre, regionId: raw.region_id };
}

export function municipioApiAEntidad(raw: MunicipioApiItem): Municipio {
  return { id: raw.id, nombre: raw.nombre, estadoId: raw.estado_id };
}

export function parroquiaApiAEntidad(raw: ParroquiaApiItem): Parroquia {
  return { id: raw.id, nombre: raw.nombre, municipioId: raw.municipio_id };
}
