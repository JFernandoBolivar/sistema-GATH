import { LIMITES_TEXTO, textoLibreRequerido } from "@/shared/validation/limites-texto";
import { z } from "zod"

export const schemaDwellingUpdate = z.object({
  datos_vivienda: z.object({
    direccion_exacta: textoLibreRequerido("La dirección", LIMITES_TEXTO.direccion),
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
    codigo_postal_id: z.coerce.number().optional(),
  }),
})
export type DwellingUpdateType = z.infer<typeof schemaDwellingUpdate>
