/**
 * Caso de uso de catálogos dependientes (cascada) del expediente (Reglas R2, R4).
 */
import type {
  RepoCatalogosDependientes,
  TipoCatalogoDependiente,
} from "../../domain/ports/catalogos-dependientes";
import type { CatalogoEmpleadoDTO } from "../dtos/empleado-dto";

export async function listarCatalogoDependiente(
  repo: RepoCatalogosDependientes,
  tipo: TipoCatalogoDependiente,
  padreId: number,
): Promise<CatalogoEmpleadoDTO[]> {
  const items = await repo.listar(tipo, padreId);
  return items.map((x) => ({ id: x.id, nombre: x.nombre }));
}
