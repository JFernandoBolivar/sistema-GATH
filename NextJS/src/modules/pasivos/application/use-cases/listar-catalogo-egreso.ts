/**
 * Casos de uso de catálogos del egreso (Reglas R2, R4).
 *
 * Alimentan el formulario `procesar_egreso` con los tipos de nómina
 * (`tipos-nomina/`) del kernel de catálogos `/api/v1/catalogos/`. Los motivos
 * los carga `MotivoSelect` según la operación (el backend decide la categoría).
 */
import type { RepoPasivos } from "../../domain/ports/repo-pasivos";
import type { CatalogoPasivoDTO } from "../dtos/pasivos-dto";

function aDTO(e: { id: number; nombre: string }): CatalogoPasivoDTO {
  return { id: e.id, nombre: e.nombre };
}

export async function listarTiposNomina(
  repo: RepoPasivos,
  soloPasivos: boolean = true,
): Promise<CatalogoPasivoDTO[]> {
  const entidades = await repo.listarTiposNomina(soloPasivos);
  return entidades.map(aDTO);
}
