import z from "zod";

export const schemaUpdateCodeTable = z.object({
  denominacioncargoid: z.number(),
  denominacioncargoespecificoid: z.number(),
  gradoid: z.number().optional(),
  tiponominaid: z.number().refine((v) => v > 0, {
    message: "Debe Seleccionar Un Valor",
  }),

  OrganismoAdscritoid: z.number().optional(),
});
export type UpdateCodeTable = z.infer<typeof schemaUpdateCodeTable>;
