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
