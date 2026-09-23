/**
 * Adaptador HTTP del puerto `RepoCatalogosDependientesFamiliar` (Regla R4).
 */
import type {
  RepoCatalogosDependientesFamiliar,
  TipoCatalogoDependienteFamiliar,
} from "../../domain/ports/catalogos-dependientes-familiar";
import { familiaresApi } from "../http/familiares-api";
import { catalogoFamiliarApiAEntidad } from "../mappers/mapper-familiares";

const getters: Record<TipoCatalogoDependienteFamiliar, (padreId: number) => ReturnType<typeof familiaresApi.getCarreras>> = {
  carreras: (id) => familiaresApi.getCarreras(id),
  menciones: (id) => familiaresApi.getMenciones(id),
};

export const repoCatalogosDependientesFamiliarApi: RepoCatalogosDependientesFamiliar = {
  async listar(tipo, padreId) {
    const items = await getters[tipo](padreId);
    return items.map(catalogoFamiliarApiAEntidad);
  },
};
