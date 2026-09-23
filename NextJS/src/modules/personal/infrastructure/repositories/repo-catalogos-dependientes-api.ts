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
    return items.map((x) => ({
      id: x.id,
      nombre: x.nombre,
      codigo: x.codigo ?? null,
      categoriaId: x.categoria_id ?? (x.categoria?.id ?? null),
      categoriaNombre: x.categoria_nombre ?? (x.categoria?.nombre_categoria ?? (x.categoria?.nombre ?? null)),
      tipoPrendaId: x.tipo_prenda_id ?? (x.tipo_prenda?.id ?? null),
      tipoPrendaNombre: x.tipo_prenda_nombre ?? (x.tipo_prenda?.categoria ?? null),
      regionId: x.region_id ?? (x.region?.id ?? null),
      regionCodigo: x.region_codigo ?? (x.region?.codigo ?? null),
      regionDescripcion: x.region_descripcion ?? (x.region?.descripcion ?? null),
    }));
  },
};
