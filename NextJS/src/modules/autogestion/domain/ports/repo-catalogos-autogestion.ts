import type { ClaveCatalogo } from "../value-objects/campos-seccion";

export interface OpcionCatalogo {
  id: number;
  nombre: string;
}

/** Catálogos de apoyo de los formularios de sección (solo lectura). */
export interface RepoCatalogosAutogestion {
  listar(clave: ClaveCatalogo, padreId?: number): Promise<OpcionCatalogo[]>;
}
