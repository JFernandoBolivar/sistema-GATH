/**
 * Adaptador HTTP del puerto `RepoCatalogosAltaInlineFamiliar` (Regla R4).
 */
import type { RepoCatalogosAltaInlineFamiliar } from "../../domain/ports/catalogos-alta-inline-familiar";
import { familiaresApi } from "../http/familiares-api";
import { catalogoFamiliarApiAEntidad } from "../mappers/mapper-familiares";

const requerirPadre = (padreId: number | null, tipo: string) => {
  if (!padreId) throw new Error(`Falta el padre para crear ${tipo}.`);
  return padreId;
};

export const repoCatalogosAltaInlineFamiliarApi: RepoCatalogosAltaInlineFamiliar = {
  async listar(tipo, padreId) {
    const items =
      tipo === "carreras"
        ? await familiaresApi.getCarreras(padreId ?? undefined)
        : tipo === "menciones"
          ? await familiaresApi.getMenciones(padreId ?? undefined)
          : await familiaresApi.getInstituciones();
    return items.map(catalogoFamiliarApiAEntidad);
  },

  async crear(tipo, nombre, padreId) {
    const creado =
      tipo === "carreras"
        ? await familiaresApi.crearCarrera(nombre, requerirPadre(padreId, "la carrera"))
        : tipo === "menciones"
          ? await familiaresApi.crearMencion(nombre, requerirPadre(padreId, "la mención"))
          : await familiaresApi.crearInstitucion(nombre);
    return { id: creado.id, nombre: creado.nombre };
  },
};
