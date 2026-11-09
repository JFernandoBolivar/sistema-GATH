/**
 * Catálogos del expediente de un pasivo (Regla R2), necesarios para resolver
 * a nombre legible los `_id` que trae el detalle (vivienda, salud, físico,
 * formación académica). Mismo conjunto de catálogos que usa `modules/personal`
 * para el mismo contrato de expediente compartido (`expediente_lectura`);
 * se duplica aquí en vez de importarlo de `modules/personal` (los módulos
 * son independientes entre sí, ninguno importa de un módulo hermano).
 */
import type { CatalogoPasivo } from "../entities/pasivo";

export interface CatalogosExpedientePasivo {
  estados: CatalogoPasivo[];
  municipios: CatalogoPasivo[];
  parroquias: CatalogoPasivo[];
  condicionesVivienda: CatalogoPasivo[];
  codigosPostales: CatalogoPasivo[];
  gruposSanguineos: CatalogoPasivo[];
  alergias: CatalogoPasivo[];
  patologias: CatalogoPasivo[];
  discapacidades: CatalogoPasivo[];
  tallas: CatalogoPasivo[];
  nivelesAcademicos: CatalogoPasivo[];
  carreras: CatalogoPasivo[];
  menciones: CatalogoPasivo[];
  instituciones: CatalogoPasivo[];
  politicas: CatalogoPasivo[];
}
