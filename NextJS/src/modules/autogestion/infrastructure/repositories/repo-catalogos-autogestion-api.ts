import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type {
  OpcionCatalogo,
  RepoCatalogosAutogestion,
} from "../../domain/ports/repo-catalogos-autogestion";
import type { ClaveCatalogo } from "../../domain/value-objects/campos-seccion";

interface ItemCatalogoApi {
  id: number;
  nombre?: string;
  codigo?: string | null;
}

interface RutaCatalogo {
  ruta: string;
  /** Nombre del filtro por catálogo padre, si lo admite. */
  filtroPadre?: string;
}

const RUTAS: Record<ClaveCatalogo, RutaCatalogo> = {
  estados: { ruta: "/api/v1/catalogos/estados/" },
  municipios: { ruta: "/api/v1/catalogos/municipios/", filtroPadre: "estado_id" },
  parroquias: { ruta: "/api/v1/catalogos/parroquias/", filtroPadre: "municipio_id" },
  condicionesVivienda: { ruta: "/api/v1/autogestion/catalogos/condiciones-vivienda/" },
  codigosPostales: {
    ruta: "/api/v1/autogestion/catalogos/codigos-postales/",
    filtroPadre: "estado_id",
  },
  nivelesAcademicos: { ruta: "/api/v1/autogestion/catalogos/niveles-academicos/" },
  carreras: { ruta: "/api/v1/autogestion/catalogos/carreras/", filtroPadre: "nivel_academico_id" },
  menciones: { ruta: "/api/v1/autogestion/catalogos/menciones/", filtroPadre: "carrera_id" },
  instituciones: { ruta: "/api/v1/autogestion/catalogos/instituciones/" },
  parentescos: { ruta: "/api/v1/catalogos/parentescos/" },
  sexos: { ruta: "/api/v1/catalogos/sexos/" },
};

export const repoCatalogosAutogestionApi: RepoCatalogosAutogestion = {
  async listar(clave, padreId) {
    const { ruta, filtroPadre } = RUTAS[clave];
    const res = await apiClient.get<ApiResponse<ItemCatalogoApi[]>>(ruta, {
      params: filtroPadre && padreId ? { [filtroPadre]: padreId } : undefined,
    });
    return res.data.map<OpcionCatalogo>((i) => ({
      id: i.id,
      nombre: i.nombre ?? i.codigo ?? `#${i.id}`,
    }));
  },
};
