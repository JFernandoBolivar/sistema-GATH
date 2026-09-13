/**
 * Caso de uso de catálogos del expediente (Reglas R2, R4). Alimentan la
 * vista de detalle del pasivo para resolver a nombre los `_id` de vivienda,
 * salud, físico y formación académica (cargos_historial ya viene resuelto
 * desde el backend, ver `domain/ports/catalogos-expediente.ts`).
 */
import type { RepoPasivos } from "../../domain/ports/repo-pasivos";
import type { CatalogosExpedientePasivoDTO } from "../dtos/pasivos-dto";

export async function listarCatalogosExpedientePasivo(
  repo: RepoPasivos,
): Promise<CatalogosExpedientePasivoDTO> {
  return repo.listarCatalogosExpediente();
}
