import z from "zod";
export const schemaCreateDependency = z.object({
  Codigo: z.string(),

  dependencia: z.string(),
});
export const schemaCreateDirectionGeneral = z.object({
  Codigo: z
    .string()

    .optional(),
  direccion_general: z.string().optional(),
});
export const schemaCreateDirectionLine = z.object({
  Codigo: z
    .string()

    .optional(),
  direccion_linea: z
    .string()

    .optional(),
});

export const schemaCreateCoordination = z.object({
  Codigo: z
    .string()

    .optional(),
  coordinacion: z
    .string()

    .optional(),
});

export const schemaCreateDirectionAdm = z
  .object({
    dependency: schemaCreateDependency,
    direction_general: schemaCreateDirectionGeneral.optional(),
    direction_line: schemaCreateDirectionLine.optional(),
    coordination: schemaCreateCoordination.optional(),
    activeDirectionGeneral: z.boolean().default(false),

    activeDirectionLine: z.boolean().default(false),
    activeCoordination: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (
      data.activeDirectionGeneral &&
      (!data.direction_general?.Codigo ||
        !data.direction_general.direccion_general)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La Dirección  es requerida",
        path: [
          "direction_general.Codigo",
          "direction_general.direccion_general",
        ],
      });
    }
    if (
      data.activeDirectionLine &&
      (!data.direction_line?.Codigo || !data.direction_line.direccion_linea)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La Dirección es requerida",
        path: ["direction_line.Codigo", "direction_line.direccion_general"],
      });
    }
    if (
      data.activeCoordination &&
      (!data.coordination?.Codigo || !data.coordination.coordinacion)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La Coordinación  es requerida",
        path: ["coordination.Codigo", "coordination.coordinacion"],
      });
    }
  });
