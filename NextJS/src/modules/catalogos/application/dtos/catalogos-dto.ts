/**
 * DTOs de Catálogos (Regla R5).
 */
export interface CatalogoItemDTO {
  id: number;
  nombre: string;
}

export interface RegionDTO {
  id: number;
  nombre: string;
}

export interface EstadoDTO {
  id: number;
  nombre: string;
  regionId: number;
}

export interface MunicipioDTO {
  id: number;
  nombre: string;
  estadoId: number;
}

export interface ParroquiaDTO {
  id: number;
  nombre: string;
  municipioId: number;
}

export interface CrearCategoriaDTO {
  nombre_categoria: string;
}

export interface CrearAlergiaDTO {
  alergia: string;
  categoria_id: number;
}

export interface CrearPatologiaDTO {
  patologia: string;
  categoria_id: number;
}

export interface CrearDiscapacidadDTO {
  discapacidad: string;
  categoria_id: number;
}

export interface CrearTallaDTO {
  valor: string;
  region_id: number;
  tipo_prenda_id: number;
}

export interface CrearRegionTallaDTO {
  codigo: string;
  descripcion?: string | null;
}

export interface CrearTipoPrendaDTO {
  categoria: string;
}

export interface EliminarCatalogoItemDTO {
  id: number;
}

