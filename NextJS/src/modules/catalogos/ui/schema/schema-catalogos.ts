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

// ----------------------------------------------------------------------
// Schemas para CRUD de Catálogos de Soporte (Zero-trust R7)
// ----------------------------------------------------------------------

export const crearCategoriaSchema = z.object({
  nombre_categoria: z
    .string()
    .trim()
    .min(1, ERROR.REQUIRED)
    .max(100, "Máximo 100 caracteres"),
});

export const crearAlergiaSchema = z.object({
  alergia: z
    .string()
    .trim()
    .min(1, ERROR.REQUIRED)
    .max(100, "Máximo 100 caracteres"),
  categoria_id: z.coerce.number().int().positive(ERROR.REQUIRED),
});

export const crearPatologiaSchema = z.object({
  patologia: z
    .string()
    .trim()
    .min(1, ERROR.REQUIRED)
    .max(100, "Máximo 100 caracteres"),
  categoria_id: z.coerce.number().int().positive(ERROR.REQUIRED),
});

export const crearDiscapacidadSchema = z.object({
  discapacidad: z
    .string()
    .trim()
    .min(1, ERROR.REQUIRED)
    .max(100, "Máximo 100 caracteres"),
  categoria_id: z.coerce.number().int().positive(ERROR.REQUIRED),
});

export const crearTallaSchema = z.object({
  valor: z
    .string()
    .trim()
    .min(1, ERROR.REQUIRED)
    .max(50, "Máximo 50 caracteres"),
  region_id: z.coerce.number().int().positive(ERROR.REQUIRED),
  tipo_prenda_id: z.coerce.number().int().positive(ERROR.REQUIRED),
});

export const crearRegionTallaSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, ERROR.REQUIRED)
    .max(10, "Máximo 10 caracteres"),
  descripcion: z.string().trim().max(100, "Máximo 100 caracteres").optional().nullable(),
});

export const crearTipoPrendaSchema = z.object({
  categoria: z
    .string()
    .trim()
    .min(1, ERROR.REQUIRED)
    .max(50, "Máximo 50 caracteres"),
});

export const eliminarItemSchema = z.object({
  id: z.coerce.number().int().positive(ERROR.REQUIRED),
});

export type CrearCategoriaFormType = z.infer<typeof crearCategoriaSchema>;
export type CrearAlergiaFormType = z.infer<typeof crearAlergiaSchema>;
export type CrearPatologiaFormType = z.infer<typeof crearPatologiaSchema>;
export type CrearDiscapacidadFormType = z.infer<typeof crearDiscapacidadSchema>;
export type CrearTallaFormType = z.infer<typeof crearTallaSchema>;
export type CrearRegionTallaFormType = z.infer<typeof crearRegionTallaSchema>;
export type CrearTipoPrendaFormType = z.infer<typeof crearTipoPrendaSchema>;
export type EliminarItemFormType = z.infer<typeof eliminarItemSchema>;

