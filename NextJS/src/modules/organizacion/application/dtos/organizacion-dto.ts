/**
 * DTOs de Organización (Regla R5).
 */
export interface DependenciaDTO {
  id: number;
  nombre: string;
}

export interface DireccionGeneralDTO {
  id: number;
  nombre: string;
  dependenciaId: number;
}

export interface DireccionLineaDTO {
  id: number;
  nombre: string;
  direccionGeneralId: number;
}

export interface CoordinacionDTO {
  id: number;
  nombre: string;
  direccionLineaId: number;
}

export interface OrganismoAdscritoDTO {
  id: number;
  nombre: string;
}
