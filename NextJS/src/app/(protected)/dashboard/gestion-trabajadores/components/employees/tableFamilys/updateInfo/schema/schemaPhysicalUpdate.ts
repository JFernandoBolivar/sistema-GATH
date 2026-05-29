import z from "zod";
export const schemaUpdatePhysical = z.object({
  perfil_fisico_familiar: z.object({
    tallaCamisa: z.coerce.number().optional(),
    tallaPantalon: z.coerce.number().optional(),
    tallaZapatos: z.coerce.number().optional(),
    tallaChaqueta: z.coerce.number().optional(),
  }),
});
export type SchemaUpdatePhysical = z.infer<typeof schemaUpdatePhysical>;
