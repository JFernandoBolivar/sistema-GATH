import { z } from "zod"

export const schemaContratoUpdate = z.object({
  contrato: z
    .array(
      z.object({
        n_contrato: z.string(),
        fecha_ingreso: z.date(),
        politica_id: z.number(),
        fecha_culminacion: z.date().nullable().optional(),
      }),
    )
    .optional(),
})

export type ContratoUpdateType = z.infer<typeof schemaContratoUpdate>
