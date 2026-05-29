import { z } from "zod";

export const schemaHealthProfile = z.object({
  perfil_salud: z.object({
    grupoSanguineo: z
      .number({
        message: "Debe seleccionar un grupo sanguíneo",
      })
      .optional(),
    patologiaCronica: z.array(z.number()).optional(),
    alergias: z.array(z.number()).optional(),
    discapacidad: z.array(z.number()).optional(),
  }),
});
export type HealthType = z.infer<typeof schemaHealthProfile>;
