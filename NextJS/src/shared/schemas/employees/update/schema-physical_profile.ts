import { z } from "zod"

export const schemaPhysicalProfileUpdate = z.object({
  perfil_fisico: z.object({
    tallaCamisa: z
      .number({
        message: "Debe seleccionar una talla de camisa",
      })
      .optional(),
    tallaPantalon: z
      .number({
        message: "Debe seleccionar una talla de pantalón",
      })
      .optional(),
    tallaZapatos: z
      .number({
        message: "Debe seleccionar una talla de zapatos",
      })
      .optional(),
    tallaChaqueta: z
      .number({
        message: "Debe seleccionar una talla de chaqueta",
      })
      .optional(),
  }),
})
export type PhysicalProfileUpdateType = z.infer<
  typeof schemaPhysicalProfileUpdate
>
