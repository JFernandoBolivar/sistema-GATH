import { z } from "zod"

export const schemaBackgroundDateUpdate = z
  .object({
    organismo_id: z
      .number({
        message: "Debe seleccionar un organismo",
      })
      .optional(),
    nuevo_organismo_nombre: z.string().optional(),
    fecha_ingreso: z
      .date({
        message: "Debe Ingresar Información Valida",
        required_error: "Este Campo Es Requerido",
      })
      .optional(),
    fecha_egreso: z
      .date({
        message: "Debe Ingresar Información Valida",
        required_error: "Este Campo Es Requerido",
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fecha_ingreso && data.fecha_egreso) {
      if (data.fecha_egreso <= data.fecha_ingreso) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "La Fecha De Egreso No Puede Ser Anterior A La Fecha De Ingreso",
          path: ["fecha_egreso"],
        })
      }
      if (data.organismo_id === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe Ingresar Información Valida",
          path: ["organismo_id"],
        })
      }
    }
    if (data.fecha_ingreso) {
      if (!data.fecha_egreso) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe Seleccionar Una Fecha De Egreso",
          path: ["fecha_egreso"],
        })
      }
    }
    if (data.fecha_egreso) {
      if (!data.fecha_ingreso) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe Seleccionar Una Fecha De Ingreso",
          path: ["fecha_ingreso"],
        })
      }
    }
  })
  .refine(
    (data) => {
      if (data.organismo_id === -1 && !data.nuevo_organismo_nombre?.trim()) {
        return false
      }
      return true
    },
    { message: "Debe escribir el nombre del nuevo organismo", path: ["nuevo_organismo_nombre"] },
  )

export const schemaBackgroundUpdate = z.object({
  antecedentes: z.array(schemaBackgroundDateUpdate).optional(),
})
export type BackgroundUpdateType = z.infer<typeof schemaBackgroundUpdate>
