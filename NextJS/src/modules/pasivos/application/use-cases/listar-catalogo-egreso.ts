/**
 * Casos de uso de catálogos del egreso (Reglas R2, R4).
 *
 * Alimentan el formulario `procesar_egreso` con los motivos de movimiento
 * (`tipos-movimiento/?categoria=EGRESO`) y los tipos de nómina
 * (`tipos-nomina/`), ambos del kernel de catálogos `/api/v1/catalogos/`.
 */
import type { RepoPasivos } from "../../domain/ports/repo-pasivos";
import type { CatalogoPasivoDTO } from "../dtos/pasivos-dto";

function aDTO(e: { id: number; nombre: string }): CatalogoPasivoDTO {
  return { id: e.id, nombre: e.nombre };
}

export async function listarMotivosEgreso(
  repo: RepoPasivos,
): Promise<CatalogoPasivoDTO[]> {
  const entidades = await repo.listarMotivosEgreso();
  return entidades.map(aDTO);
}

export async function listarTiposNomina(
  repo: RepoPasivos,
): Promise<CatalogoPasivoDTO[]> {
  const entidades = await repo.listarTiposNomina();
  return entidades.map(aDTO);
}
