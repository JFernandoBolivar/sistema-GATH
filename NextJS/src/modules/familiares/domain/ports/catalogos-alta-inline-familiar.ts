/**
 * Puerto de alta inline de catálogos académicos del familiar (Reglas R1, R4):
 * la opción "Otra X" del legado en Carrera, Mención e Institución. Mismo
 * patrón que `modules/personal/domain/ports/catalogos-alta-inline.ts`.
 *
 * `padreId` es obligatorio para carreras (nivel académico) y menciones
 * (carrera); para instituciones se ignora.
 */
import type { CatalogoFamiliar } from "./repo-familiares";

export type TipoCatalogoInlineFamiliar = "carreras" | "menciones" | "instituciones";

export interface RepoCatalogosAltaInlineFamiliar {
  listar(tipo: TipoCatalogoInlineFamiliar, padreId: number | null): Promise<CatalogoFamiliar[]>;
  crear(tipo: TipoCatalogoInlineFamiliar, nombre: string, padreId: number | null): Promise<CatalogoFamiliar>;
}
