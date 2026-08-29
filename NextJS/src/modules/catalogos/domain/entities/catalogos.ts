/**
 * Entidades de Dominio de Catálogos y Geografía (Regla R1).
 */
export interface CatalogoItem {
  id: number;
  nombre: string;
}

export interface Region {
  id: number;
  nombre: string;
}

export interface Estado {
  id: number;
  nombre: string;
  regionId: number;
}

export interface Municipio {
  id: number;
  nombre: string;
  estadoId: number;
}

export interface Parroquia {
  id: number;
  nombre: string;
  municipioId: number;
}
