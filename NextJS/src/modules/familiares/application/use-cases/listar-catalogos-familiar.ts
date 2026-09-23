/**
 * Caso de uso de catálogos de soporte del formulario de familiar (parentesco, sexo).
 */
import type { RepoFamiliares } from "../../domain/ports/repo-familiares";
import type { CatalogosFamiliarDTO } from "../dtos/familiar-dto";

export async function listarCatalogosFamiliar(repo: RepoFamiliares): Promise<CatalogosFamiliarDTO> {
  const c = await repo.listarCatalogos();
  return {
    parentescos: c.parentescos,
    sexos: c.sexos,
  };
}
