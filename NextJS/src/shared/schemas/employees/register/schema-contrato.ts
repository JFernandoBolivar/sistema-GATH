import { z } from "zod"

export const schemaContratoItem = z.object({
  n_contrato: z
    .string({
      required_error: "El número de contrato es requerido",
    })
    .min(3, { message: "Debe Ingresar Al Menos 3 Caracteres" }),
  fecha_ingreso: z.date({
    message: "Debe Ingresar Una Fecha Requerida",
    required_error: "La Fecha De Ingreso Es Requerida",
  }),
  politica_id: z.coerce
    .number({
      required_error: "La política es requerida",
    })
    .refine((val) => val > 0, {
      message: "Debe Seleccionar Una Política",
    }),
  fecha_culminacion: z
    .date({
      message: "Debe Ingresar Una Fecha Valida",
    })
    .optional(),
})

export const schemaContrato = z.object({
  contrato: z.array(schemaContratoItem).optional(),
})

export type ContratoType = z.infer<typeof schemaContrato>
