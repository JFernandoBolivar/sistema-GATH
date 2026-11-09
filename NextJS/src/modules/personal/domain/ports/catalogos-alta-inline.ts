/**
 * Puerto de alta inline de catálogos académicos (Reglas R1, R4): la opción
 * "Otra X" del legado en Carrera, Mención, Institución y Capacitación.
 *
 * `padreId` es obligatorio para carreras (nivel académico) y menciones
 * (carrera); para instituciones y capacitaciones se ignora.
 */
import type { CatalogoExpediente } from "../entities/empleado";

export type TipoCatalogoInline = "carreras" | "menciones" | "instituciones" | "capacitaciones";

export interface RepoCatalogosAltaInline {
  listar(tipo: TipoCatalogoInline, padreId: number | null): Promise<CatalogoExpediente[]>;
  crear(tipo: TipoCatalogoInline, nombre: string, padreId: number | null): Promise<CatalogoExpediente>;
}
