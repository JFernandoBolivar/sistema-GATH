/**
 * Puerto de catálogos dependientes del expediente (Reglas R1, R4).
 *
 * El wizard de registro (`/personal/registrar`) necesita cargar en cascada
 * catálogos filtrados por un padre (municipios por estado, parroquias por
 * municipio, códigos postales por estado, carreras por nivel académico,
 * menciones por carrera y tallas por tipo de prenda), igual que el
 * legado. El backend ya expone esos filtros por query param.
 */
import type { CatalogoExpediente } from "../entities/empleado";

export type TipoCatalogoDependiente =
  | "municipios"
  | "parroquias"
  | "codigosPostales"
  | "carreras"
  | "menciones"
  | "tallas";

export interface RepoCatalogosDependientes {
  listar(tipo: TipoCatalogoDependiente, padreId: number): Promise<CatalogoExpediente[]>;
}
