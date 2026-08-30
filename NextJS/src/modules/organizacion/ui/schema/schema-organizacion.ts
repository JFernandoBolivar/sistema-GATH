import { z } from "zod";
import { ERROR, REGEX } from "@/shared/domain/validation";

/** Filtro de exploración jerárquica (zero-trust R7). */
export const organizacionFilterSchema = z.object({
  dependenciaId: z.number().optional(),
  direccionGeneralId: z.number().optional(),
  direccionLineaId: z.number().optional(),
});

/** Identificador de cualquier nodo organizacional (crear/actualizar/eliminar). */
export const organizacionIdSchema = z.object({
  id: z.number().int().positive({ message: "Identificador inválido" }),
});

const codigoField = z
  .string()
  .trim()
  .min(1, ERROR.REQUIRED)
  .max(20, ERROR.MAX_LENGTH(20));

const nombreField = z
  .string()
  .trim()
  .min(2, ERROR.MIN_LENGTH(2))
  .max(200, ERROR.MAX_LENGTH(200));

const idPadre = z.number().int().positive().nullish().default(null);

/** Dependencia (crear/actualizar) — `DependenciaWriteSerializer` del backend. */
export const dependenciaSchema = z.object({
  codigo: codigoField,
  nombre: nombreField,
});

/** Dirección general (crear/actualizar) — `DireccionGeneralWriteSerializer`. */
export const direccionGeneralSchema = z.object({
  codigo: codigoField,
  nombre: nombreField,
  dependenciaId: idPadre,
});

/** Dirección de línea (crear/actualizar) — `DireccionLineaWriteSerializer`. */
export const direccionLineaSchema = z.object({
  codigo: codigoField,
  nombre: nombreField,
  direccionGeneralId: idPadre,
});

/** Coordinación (crear/actualizar) — `CoordinacionWriteSerializer`. */
export const coordinacionSchema = z.object({
  codigo: codigoField,
  nombre: nombreField,
  direccionLineaId: idPadre,
});

/** Organismo adscrito (crear/actualizar) — `OrganismoAdscritoWriteSerializer`. */
export const organismoAdscritoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, ERROR.MIN_LENGTH(2))
    .max(50, ERROR.MAX_LENGTH(50)),
  parentId: idPadre,
});

export type OrganizacionFilterType = z.infer<typeof organizacionFilterSchema>;
export type DependenciaFormType = z.infer<typeof dependenciaSchema>;
export type DireccionGeneralFormType = z.infer<typeof direccionGeneralSchema>;
export type DireccionLineaFormType = z.infer<typeof direccionLineaSchema>;
export type CoordinacionFormType = z.infer<typeof coordinacionSchema>;
export type OrganismoAdscritoFormType = z.infer<typeof organismoAdscritoSchema>;
