/**
 * Adaptador HTTP del puerto `RepoCatalogosAltaInline` (Regla R4).
 */
import type { RepoCatalogosAltaInline } from "../../domain/ports/catalogos-alta-inline";
import { catalogosInlineApi } from "../http/catalogos-inline-api";
import { personalApi } from "../http/personal-api";

const requerirPadre = (padreId: number | null, tipo: string) => {
  if (!padreId) throw new Error(`Falta el padre para crear ${tipo}.`);
  return padreId;
};

export const repoCatalogosAltaInlineApi: RepoCatalogosAltaInline = {
  async listar(tipo, padreId) {
    const items =
      tipo === "carreras"
        ? await personalApi.getCarreras(padreId ?? undefined)
        : tipo === "menciones"
          ? await personalApi.getMenciones(padreId ?? undefined)
          : tipo === "instituciones"
            ? await personalApi.getInstituciones()
            : await personalApi.getCapacitaciones();
    return items.map((x) => ({ id: x.id, nombre: x.nombre }));
  },

  async crear(tipo, nombre, padreId) {
    const creado =
      tipo === "carreras"
        ? await catalogosInlineApi.crearCarrera(nombre, requerirPadre(padreId, "la carrera"))
        : tipo === "menciones"
          ? await catalogosInlineApi.crearMencion(nombre, requerirPadre(padreId, "la mención"))
          : tipo === "instituciones"
            ? await catalogosInlineApi.crearInstitucion(nombre)
            : await catalogosInlineApi.crearCapacitacion(nombre);
    return { id: creado.id, nombre: creado.nombre };
  },
};
