import { z } from "zod";
import { ERROR } from "@/shared/validation/messages";

/**
 * Códigos reales de catálogos de solo-lectura expuestos por el backend
 * (`BACKEND/apps/catalogos/`). Los dos últimos (categorías-movimiento y
 * tipos-movimiento) existen en el API pero aún no tienen Server Action en el
 * módulo frontal; se validan igual para no romper contratos futuros.
 */
export const CATALOGOS_CODIGOS = [
  "regiones",
  "estados",
  "municipios",
  "parroquias",
  "sexos",
  "estatus",
  "tipos-personal",
  "tipos-nomina",
  "parentescos",
  "tipos-procedencia",
  "grados",
  "categorias-movimiento",
  "tipos-movimiento",
  "estado-civil",
  "politicas",
  "condiciones-vivienda",
  "codigos-postales",
  "grupos-sanguineos",
  "niveles-academicos",
  "carreras",
  "menciones",
  "instituciones",
  "tipos-prenda",
  "regiones-talla",
  "tallas",
  "capacitaciones",
  "grupos-capacitacion",
  "alergias",
  "patologias",
  "discapacidades",
] as const;

export const catalogoFiltroSchema = z.object({
  codigo: z.enum(CATALOGOS_CODIGOS, {
    message: ERROR.REQUIRED,
  }),
});

/** Filtro de catálogos geográficos por id padre opcional (zero-trust R7). */
export const idPadreFiltroSchema = z.object({
  idPadre: z.number().int().positive().optional().nullable(),
});

export type CatalogoFiltroFormType = z.infer<typeof catalogoFiltroSchema>;
export type CodigoCatalogo = CatalogoFiltroFormType["codigo"];
