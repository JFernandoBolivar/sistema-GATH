/**
 * Puerto de catálogos dependientes (cascada) del mini-expediente del
 * familiar (Reglas R1, R4): carreras por nivel académico, menciones por
 * carrera, tallas por tipo de prenda. Mismo patrón que
 * `modules/personal/domain/ports/catalogos-dependientes.ts` — deliberadamente
 * NO se importa de `modules/personal` (aislamiento Feature-Based), aunque el
 * backend expone los mismos catálogos globales (`/api/v1/personal/catalogos/`).
 */
import type { CatalogoFamiliar } from "./repo-familiares";

export type TipoCatalogoDependienteFamiliar = "carreras" | "menciones";

export interface RepoCatalogosDependientesFamiliar {
  listar(tipo: TipoCatalogoDependienteFamiliar, padreId: number): Promise<CatalogoFamiliar[]>;
}
