import { z } from "zod"

export const schemaHealthProfileUpdate = z.object({
  perfil_salud: z.object({
    grupoSanguineo: z
      .number({
        message: "Debe seleccionar un grupo sanguíneo",
      })
      .optional(),
    patologiaCronica: z.array(z.number()).default([]).optional(),
    alergias: z.array(z.number()).default([]).optional(),
    discapacidad: z.array(z.number()).default([]).optional(),
  }),
})
export type HealthUpdateType = z.infer<typeof schemaHealthProfileUpdate>
