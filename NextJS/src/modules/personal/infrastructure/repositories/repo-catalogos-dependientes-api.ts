/**
 * Adaptador HTTP del puerto `RepoCatalogosDependientes` (Regla R4).
 */
import type {
  RepoCatalogosDependientes,
  TipoCatalogoDependiente,
} from "../../domain/ports/catalogos-dependientes";
import { personalApi } from "../http/personal-api";

const getters: Record<TipoCatalogoDependiente, (padreId: number) => Promise<{ id: number; nombre: string }[]>> = {
  municipios: (id) => personalApi.getMunicipios(id),
  parroquias: (id) => personalApi.getParroquias(id),
  codigosPostales: (id) => personalApi.getCodigosPostales(id),
  carreras: (id) => personalApi.getCarreras(id),
  menciones: (id) => personalApi.getMenciones(id),
  tallas: (id) => personalApi.getTallas(id),
};

export const repoCatalogosDependientesApi: RepoCatalogosDependientes = {
  async listar(tipo, padreId) {
    const items = await getters[tipo](padreId);
    return items.map((x) => ({ id: x.id, nombre: x.nombre }));
  },
};
