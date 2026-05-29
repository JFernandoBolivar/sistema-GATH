import z from "zod";

export const schemaUpdateCodeTable = z.object({
  denominacioncargoid: z.number(),
  denominacioncargoespecificoid: z.number(),
  gradoid: z.number().optional(),
  tiponominaid: z.number().refine((v) => v > 0, {
    message: "Debe Seleccionar Un Valor",
  }),
  Dependencia: z.number().refine((v) => v > 0, {
    message: "Debe Seleccionar Un Valor",
  }),
  OrganismoAdscritoid: z.number().optional(),
  DireccionGeneral: z.number().default(0),
  DireccionLinea: z.number().default(0),
  Coordinacion: z.number().default(0),
});
export type UpdateCodeTable = z.infer<typeof schemaUpdateCodeTable>;
