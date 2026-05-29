import { z } from "zod";

export const schemaBackgroundItem = z
  .object({
    fecha_ingreso: z.date().optional(),
    fecha_egreso: z.date().optional(),
    organismo_id: z
      .number({ message: "Seleccione un organismo" })
      .optional(),
    nuevo_organismo_nombre: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fecha_ingreso && data.fecha_egreso) {
      if (data.fecha_egreso <= data.fecha_ingreso) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La Fecha De Egreso No Puede Ser Anterior A La Fecha De Ingreso",
          path: ["fecha_egreso"],
        });
      }
      if (data.organismo_id === undefined || data.organismo_id === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe seleccionar un organismo",
          path: ["organismo_id"],
        });
      }
    }
    if (data.fecha_ingreso && !data.fecha_egreso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe Seleccionar Una Fecha De Egreso",
        path: ["fecha_egreso"],
      });
    }
    if (data.fecha_egreso && !data.fecha_ingreso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe Seleccionar Una Fecha De Ingreso",
        path: ["fecha_ingreso"],
      });
    }
  })
  .refine(
    (data) => {
      if (data.organismo_id === -1 && !data.nuevo_organismo_nombre?.trim()) {
        return false;
      }
      return true;
    },
    { message: "Debe escribir el nombre del nuevo organismo", path: ["nuevo_organismo_nombre"] },
  );

export const schemaBackground = z.object({
  antecedentes: z.array(schemaBackgroundItem).optional(),
});
export type BackgroundType = z.infer<typeof schemaBackground>;
