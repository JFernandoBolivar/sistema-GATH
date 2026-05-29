import { z } from "zod"

export const schemaPhysicalProfile = z.object({
  perfil_fisico: z.object({
    tallaCamisa: z
      .number({
        message: "Debe seleccionar una talla de camisa",
      })
      .min(1, "Debe seleccionar una talla de camisa"),
    tallaPantalon: z
      .number({
        message: "Debe seleccionar una talla de pantalón",
      })
      .min(1, "Debe seleccionar una talla de pantalón"),
    tallaZapatos: z
      .number({
        message: "Debe seleccionar una talla de zapatos",
      })
      .min(1, "Debe seleccionar una talla de zapatos"),
    tallaChaqueta: z
      .number({
        message: "Debe seleccionar una talla de chaqueta",
      })
      .optional(),
  }),
})
export type PhysicalProfileType = z.infer<typeof schemaPhysicalProfile>
