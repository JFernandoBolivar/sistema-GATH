/**
 * Entidades de Dominio de Organización (Regla R1).
 */
export interface Dependencia {
  id: number;
  nombre: string;
}

export interface DireccionGeneral {
  id: number;
  nombre: string;
  dependenciaId: number;
}

export interface DireccionLinea {
  id: number;
  nombre: string;
  direccionGeneralId: number;
}

export interface Coordinacion {
  id: number;
  nombre: string;
  direccionLineaId: number;
}

export interface OrganismoAdscrito {
  id: number;
  nombre: string;
}
