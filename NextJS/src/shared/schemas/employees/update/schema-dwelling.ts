import { z } from "zod"

export const schemaDwellingUpdate = z.object({
  datos_vivienda: z.object({
    direccion_exacta: z
      .string({
        message: "Debe Ingresar Información Valida",
      })
      .min(3, {
        message: "Minimo 3 Caracteres",
      }),
    estado_id: z
      .number({
        message: "Debe Ingresar Información Valida",
      })
      .refine((v) => v > 0, {
        message: "Debe Seleccionar Un Valor",
      }),
    municipio_id: z
      .number({
        message: "Debe Ingresar Información Valida",
      })
      .refine((v) => v > 0, {
        message: "Debe Seleccionar Un Valor",
      }),
    parroquia: z
      .number({
        message: "Debe Ingresar Información Valida",
      })
      .refine((v) => v > 0, {
        message: "Debe Seleccionar Un Valor",
      }),
    condicion_vivienda_id: z
      .number({
        message: "Debe Ingresar Información Valida",
      })
      .refine((v) => v > 0, {
        message: "Debe Seleccionar Un Valor",
      }),
    codigo_postal: z.string().max(10).optional(),
  }),
})
export type DwellingUpdateType = z.infer<typeof schemaDwellingUpdate>
