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

/** Jerarquía completa de dependencia para creación en cascada (paridad legacy `create-dependency.tsx`). */
export const hierarchyDependencySchema = z
  .object({
    dependency: z.object({
      codigo: z.string().trim().min(1, "El código de la dependencia es requerido"),
      nombre: z.string().trim().min(1, "El nombre de la dependencia es requerido"),
    }),
    direction_general: z
      .object({
        codigo: z.string().optional(),
        nombre: z.string().optional(),
      })
      .optional(),
    direction_line: z
      .object({
        codigo: z.string().optional(),
        nombre: z.string().optional(),
      })
      .optional(),
    coordination: z
      .object({
        codigo: z.string().optional(),
        nombre: z.string().optional(),
      })
      .optional(),
    activeDirectionGeneral: z.boolean().default(false),
    activeDirectionLine: z.boolean().default(false),
    activeCoordination: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (
      data.activeDirectionGeneral &&
      (!data.direction_general?.codigo?.trim() || !data.direction_general?.nombre?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El código y nombre de la Dirección General son requeridos",
        path: ["direction_general", "nombre"],
      });
    }
    if (
      data.activeDirectionLine &&
      (!data.direction_line?.codigo?.trim() || !data.direction_line?.nombre?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El código y nombre de la Dirección de Línea son requeridos",
        path: ["direction_line", "nombre"],
      });
    }
    if (
      data.activeCoordination &&
      (!data.coordination?.codigo?.trim() || !data.coordination?.nombre?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El código y nombre de la Coordinación son requeridos",
        path: ["coordination", "nombre"],
      });
    }
  });

export type HierarchyDependencyFormType = z.infer<typeof hierarchyDependencySchema>;

export const updateDependenciaSchema = z.object({
  id: z.number().int().positive({ message: "Debe seleccionar un nivel" }),
  codigo: codigoField,
  nombre: nombreField,
});

export const updateDireccionGeneralSchema = z.object({
  dependenciaId: z.number().int().positive({ message: "Debe seleccionar un nivel" }),
  id: z.number().int().positive({ message: "Debe seleccionar una dirección general" }),
  codigo: codigoField,
  nombre: nombreField,
});

export const updateDireccionLineaSchema = z.object({
  dependenciaId: z.number().int().positive({ message: "Debe seleccionar un nivel" }),
  direccionGeneralId: z.number().int().positive({ message: "Debe seleccionar una dirección general" }),
  id: z.number().int().positive({ message: "Debe seleccionar una división o coordinación" }),
  codigo: codigoField,
  nombre: nombreField,
});

export const updateCoordinacionSchema = z.object({
  dependenciaId: z.number().int().positive({ message: "Debe seleccionar un nivel" }),
  direccionGeneralId: z.number().int().positive({ message: "Debe seleccionar una dirección general" }),
  direccionLineaId: z.number().int().positive({ message: "Debe seleccionar una división de línea" }),
  id: z.number().int().positive({ message: "Debe seleccionar una coordinación" }),
  codigo: codigoField,
  nombre: nombreField,
});

export type UpdateDependenciaFormType = z.infer<typeof updateDependenciaSchema>;
export type UpdateDireccionGeneralFormType = z.infer<typeof updateDireccionGeneralSchema>;
export type UpdateDireccionLineaFormType = z.infer<typeof updateDireccionLineaSchema>;
export type UpdateCoordinacionFormType = z.infer<typeof updateCoordinacionSchema>;

