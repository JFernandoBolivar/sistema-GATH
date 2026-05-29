import { z } from "zod";

export const schemaHealthProfileUpdateFamily = z.object({
  perfil_salud_familiar: z.object({
    grupoSanguineo: z
      .number({
        message: "Debe seleccionar un grupo sanguíneo",
      })
      .optional(),
    patologiaCronica: z.array(z.number()).default([]).optional(),
    alergias: z.array(z.number()).default([]).optional(),

    discapacidad: z.array(z.number()).default([]).optional(),
  }),
});
export type HealthUpdateFamilyType = z.infer<
  typeof schemaHealthProfileUpdateFamily
>;
