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
    nivelesAcademicos: c.nivelesAcademicos,
    carreras: c.carreras,
    menciones: c.menciones,
    instituciones: c.instituciones,
    tiposPrenda: c.tiposPrenda,
    tallas: c.tallas,
    gruposSanguineos: c.gruposSanguineos,
    alergias: c.alergias,
    patologias: c.patologias,
    discapacidades: c.discapacidades,
  };
}
