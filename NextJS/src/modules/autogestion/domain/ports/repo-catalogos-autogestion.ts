import type { ClaveCatalogo } from "../value-objects/campos-seccion";
import type { TipoSoporteConfigurado } from "../value-objects/tipos-soporte";

export interface OpcionCatalogo {
  id: number;
  nombre: string;
  /** Solo en países: si es el país por defecto (Venezuela). */
  esVenezuela?: boolean | null;
}

/** Tipo de soporte permitido por sección (incluye la sección para agrupar). */
export type TipoSoporteSeccion = TipoSoporteConfigurado & { seccion: string };

/** Catálogos de apoyo de los formularios de sección (solo lectura). */
export interface RepoCatalogosAutogestion {
  listar(clave: ClaveCatalogo, padreId?: number): Promise<OpcionCatalogo[]>;
  listarTiposSoporte(): Promise<TipoSoporteSeccion[]>;
}
