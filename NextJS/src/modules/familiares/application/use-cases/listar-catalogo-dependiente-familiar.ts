/**
 * Caso de uso de catálogos dependientes (cascada) del mini-expediente del
 * familiar (Reglas R2, R4).
 */
import type {
  RepoCatalogosDependientesFamiliar,
  TipoCatalogoDependienteFamiliar,
} from "../../domain/ports/catalogos-dependientes-familiar";
import type { CatalogoFamiliarDTO } from "../dtos/familiar-dto";

export async function listarCatalogoDependienteFamiliar(
  repo: RepoCatalogosDependientesFamiliar,
  tipo: TipoCatalogoDependienteFamiliar,
  padreId: number,
): Promise<CatalogoFamiliarDTO[]> {
  const items = await repo.listar(tipo, padreId);
  return items.map((x) => ({
    id: x.id,
    nombre: x.nombre,
    codigo: x.codigo ?? null,
    categoriaId: x.categoriaId ?? null,
    categoriaNombre: x.categoriaNombre ?? null,
    tipoPrendaId: x.tipoPrendaId ?? null,
    tipoPrendaNombre: x.tipoPrendaNombre ?? null,
    regionId: x.regionId ?? null,
    regionCodigo: x.regionCodigo ?? null,
    regionDescripcion: x.regionDescripcion ?? null,
  }));
}
