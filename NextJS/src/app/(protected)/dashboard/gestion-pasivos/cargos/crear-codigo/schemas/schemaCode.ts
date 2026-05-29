import z from "zod";

export const schemaCodePasive = z.object({
  codigo: z.string(),
  denominacioncargoid: z.number(),
  denominacioncargoespecificoid: z.number(),
  gradoid: z.number().optional(),
  tiponominaid: z.number(),
  OrganismoAdscritoid: z.number().default(0),
});
